import * as mockttp from 'mockttp';
import * as path from 'path';
import * as fs from 'fs';
import { MOCKTTP_PORT } from './config-tests';
import { Readable } from 'stream';

// Helper to get IPv4 URL - mockServer.url returns http://localhost:PORT but
// on macOS, localhost may resolve to ::1 (IPv6) while the server listens on
// 127.0.0.1 (IPv4), causing fetch to fail. This forces IPv4.
function getIPv4Url(): string {
	return mockServer.url.replace('://localhost:', '://127.0.0.1:');
}

export const apiResponsePath = path.normalize(
	path.join(__dirname, 'test-data', 'api-response'),
);

interface ScopeOpts {
	optional?: boolean;
	persist?: boolean;
	times?: number;
}

interface MockParams extends ScopeOpts {
	status?: number;
	body?: string | object;
	file?: string;
	host?: string;
}

let mockServer: mockttp.Mockttp;

export class MockHttpServer {
	private nonOptionalEndpoints: Array<{
		endpoint: mockttp.MockedEndpoint;
		method: string;
		path: string | RegExp;
	}> = [];
	private originalDockerHost: string | undefined;
	private originalGetBalenaSdk: (() => any) | undefined;

	public async start() {
		mockServer = mockttp.getLocal();
		await mockServer.start(MOCKTTP_PORT);
		await mockServer.forUnmatchedRequest().thenCallback((req) => {
			console.error(`[UNMOCKED REQUEST] ${req.method} ${req.url}`);
			return {
				status: 404,
				body: `Unmocked request: ${req.method} ${req.url}`,
			};
		});

		const { getSdk } = await import('balena-sdk');
		const sdk = getSdk({
			apiUrl: mockServer.url,
		});
		const { getStorage } = await import('balena-settings-storage');
		const settings = await import('balena-settings-client');
		const dataDirectory: string = settings.get('dataDirectory');
		const storage = getStorage({ dataDirectory });
		await storage.set('token', 'test-token-for-ssh-test');

		const lazyModule = await import('../build/utils/lazy');
		this.originalGetBalenaSdk = lazyModule.getBalenaSdk;
		// @ts-expect-error - Overriding read-only property for testing
		lazyModule.getBalenaSdk = () => sdk;

		this.originalDockerHost = process.env.DOCKER_HOST;
		process.env.DOCKER_HOST = mockServer.url;
	}

	public async stop() {
		await mockServer.stop();
		// Restore original DOCKER_HOST
		if (this.originalDockerHost === undefined) {
			delete process.env.DOCKER_HOST;
		} else {
			process.env.DOCKER_HOST = this.originalDockerHost;
		}
		// Restore original getBalenaSdk to prevent module state pollution
		if (this.originalGetBalenaSdk) {
			const lazyModule = await import('../build/utils/lazy');
			// @ts-expect-error - Overriding read-only property for testing
			lazyModule.getBalenaSdk = this.originalGetBalenaSdk;
		}
	}

	public async assertAllCalled() {
		const uncalledEndpoints = [];
		for (const { endpoint, method, path } of this.nonOptionalEndpoints) {
			const requests = await endpoint.getSeenRequests();
			if (requests.length === 0) {
				const pathStr = path instanceof RegExp ? path.source : path;
				uncalledEndpoints.push(`${method} ${pathStr}`);
			}
		}
		if (uncalledEndpoints.length > 0) {
			const endpointList = uncalledEndpoints.map((e) => `  - ${e}`).join('\n');
			throw new Error(
				`Expected ${uncalledEndpoints.length} non-optional mock(s) to be called, but they were not:\n${endpointList}`,
			);
		}
		this.nonOptionalEndpoints = [];
	}

	public get mockttp() {
		return mockServer;
	}

	private async createMock(
		method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
		$path: string | RegExp,
		defaultResponse: { status: number; body?: string | object; file?: string },
		opts: MockParams = {},
	): Promise<mockttp.MockedEndpoint> {
		const {
			optional = false,
			persist = false,
			times,
			status = defaultResponse.status,
			body = defaultResponse.body,
			file = defaultResponse.file,
		} = opts;

		const methodMap = {
			GET: mockServer.forGet.bind(mockServer),
			POST: mockServer.forPost.bind(mockServer),
			PUT: mockServer.forPut.bind(mockServer),
			DELETE: mockServer.forDelete.bind(mockServer),
			PATCH: mockServer.forPatch.bind(mockServer),
		} as const;

		// Use a catch-all for forGet/forPost/etc, then apply the actual matching in .matching()
		let builder = methodMap[method]($path).matching((req) => {
			const decodedPath = decodeURIComponent(req.path);
			if (typeof $path === 'string') {
				const expectedPath = decodeURIComponent($path);
				return decodedPath.includes(expectedPath);
			} else {
				return $path.test(decodedPath);
			}
		});

		if (persist) {
			builder = builder.always();
		}
		if (times && times > 0) {
			builder = builder.times(times);
		}

		let rule: mockttp.MockedEndpoint;

		if (file !== undefined) {
			const filePath = path.join(apiResponsePath, file);
			const fileContent = fs.readFileSync(filePath, 'utf8');
			rule = await builder.thenReply(status, fileContent, {
				'Content-Type': 'application/json',
			});
		} else if (body !== undefined) {
			const responseBody =
				typeof body === 'object' ? JSON.stringify(body) : String(body);
			rule = await builder.thenReply(status, responseBody, {
				'Content-Type': 'application/json',
			});
		} else {
			rule = await builder.thenReply(status);
		}

		if (!optional) {
			this.nonOptionalEndpoints.push({
				endpoint: rule,
				method,
				path: $path,
			});
		}

		return rule;
	}

	public api = {
		expectWhoAmIFail: (opts?: ScopeOpts) =>
			this.createMock('GET', '/actor/v1/whoami', { status: 401 }, opts),

		expectGetWhoAmI: (opts?: ScopeOpts) =>
			this.createMock(
				'GET',
				'/actor/v1/whoami',
				{
					status: 200,
					body: {
						id: 1234,
						actorType: 'user',
						actorTypeId: 99999,
						username: 'gh_user',
						email: 'testuser@test.com',
					},
				},
				opts,
			),

		expectDeviceWhoAmI: (opts?: ScopeOpts) =>
			this.createMock(
				'GET',
				'/actor/v1/whoami',
				{
					status: 200,
					body: {
						id: 1235,
						actorType: 'device',
						actorTypeId: 88888,
						uuid: 'a11dc1acd31b623a0e4e084a6cf13aaa',
					},
				},
				opts,
			),

		expectApplicationWhoAmI: (opts?: ScopeOpts) =>
			this.createMock(
				'GET',
				'/actor/v1/whoami',
				{
					status: 200,
					body: {
						id: 1236,
						actorType: 'application',
						actorTypeId: 77777,
						slug: 'mytestorf/mytestfleet',
					},
				},
				opts,
			),

		expectGetRelease: (opts?: ScopeOpts) =>
			this.createMock(
				'GET',
				/\/v7\/release($|[(?])/,
				{
					status: 200,
					file: 'release-GET-v7.json',
				},
				opts,
			),

		expectGetApplication: (
			opts?: { expandArchitecture?: boolean } & ScopeOpts,
		) => {
			const { expandArchitecture, ...scopeOpts } = opts || {};
			return this.createMock(
				'GET',
				/\/v7\/application/,
				{
					status: 200,
					file: expandArchitecture
						? 'application-GET-v7-expanded-app-type-cpu-arch.json'
						: 'application-GET-v7-expanded-app-type.json',
				},
				scopeOpts,
			);
		},

		expectGetReleaseWithReleaseAssets: (
			opts?: ScopeOpts & { empty?: boolean },
		) => {
			const { empty = false, ...scopeOpts } = opts || {};
			const releaseAssets = empty
				? []
				: [
						{
							id: 1,
							asset_key: 'config.json',
							asset: {
								filename: 'config.json',
								size: 1024,
								content_type: 'application/json',
							},
						},
						{
							id: 2,
							asset_key: 'app.tar.gz',
							asset: {
								filename: 'app.tar.gz',
								size: 5242880,
								content_type: 'application/gzip',
							},
						},
					];

			return this.createMock(
				'GET',
				/\/v7\/release($|[(?])/,
				{
					status: 200,
					body: {
						d: [
							{
								id: 142334,
								release_asset: releaseAssets,
							},
						],
					},
				},
				scopeOpts,
			);
		},

		expectDeleteReleaseAsset: (
			opts: ScopeOpts & { assetKey: string; releaseId?: number },
		) => {
			const { assetKey, releaseId = 142334, ...scopeOpts } = opts;
			return this.createMock(
				'DELETE',
				`/v7/release_asset(release=${releaseId},asset_key=%27${assetKey}%27)`,
				{ status: 200 },
				scopeOpts,
			);
		},

		expectGetReleaseAsset: (
			opts?: ScopeOpts & { found?: boolean; assetId?: number },
		) => {
			const { found = true, assetId, ...scopeOpts } = opts || {};
			if (found && assetId) {
				return this.createMock(
					'GET',
					/\/v7\/release_asset/,
					{
						status: 200,
						body: {
							d: [
								{
									id: assetId,
									asset: {
										href: `${getIPv4Url()}/download/release-asset-${assetId}.bin`,
										size: 1024,
										content_type: 'application/octet-stream',
									},
								},
							],
						},
					},
					scopeOpts,
				);
			} else if (found) {
				return this.createMock(
					'GET',
					/\/v7\/release_asset/,
					{
						status: 200,
						body: {
							d: [
								{
									id: 456,
									asset: {
										href: `${getIPv4Url()}/download/release-asset-456.bin`,
										size: 1024,
										content_type: 'application/octet-stream',
									},
								},
							],
						},
					},
					scopeOpts,
				);
			} else {
				return this.createMock(
					'GET',
					/\/v7\/release_asset/,
					{ status: 200, body: { d: [] } },
					scopeOpts,
				);
			}
		},

		expectGetReleaseAssetMissingOnce: async (
			opts?: ScopeOpts & { assetId?: number },
		) => {
			const { assetId = 456, ...scopeOpts } = opts || {};
			// First call returns empty
			await this.createMock(
				'GET',
				/\/v7\/release_asset/,
				{ status: 200, body: { d: [] } },
				{ ...scopeOpts, times: 1 },
			);
			// Subsequent calls return found
			return this.createMock(
				'GET',
				/\/v7\/release_asset/,
				{
					status: 200,
					body: {
						d: [
							{
								id: assetId,
								asset: {
									href: `${getIPv4Url()}/download/release-asset-${assetId}.bin`,
									size: 1024,
									content_type: 'application/octet-stream',
								},
							},
						],
					},
				},
				scopeOpts,
			);
		},

		expectPostReleaseAsset: (
			opts?: ScopeOpts & { assetKey?: string; assetId?: number },
		) => {
			const { assetKey, assetId = 123, ...scopeOpts } = opts || {};
			return this.createMock(
				'POST',
				/\/v7\/release_asset($|\?)/,
				{ status: 201, body: { id: assetId, asset_key: assetKey } },
				scopeOpts,
			);
		},

		expectPatchReleaseAsset: (opts: ScopeOpts & { assetId: number }) => {
			const { assetId, ...scopeOpts } = opts;
			return this.createMock(
				'PATCH',
				/\/v7\/release_asset/,
				{ status: 200, body: { id: assetId } },
				scopeOpts,
			);
		},

		expectBeginUpload: (
			opts: ScopeOpts & {
				assetId: number;
				uuid?: string;
				uploadPath?: string;
				chunkSize?: number;
			},
		) => {
			const {
				assetId,
				uuid = 'test-upload-uuid',
				uploadPath = `/upload/part1/${assetId}`,
				chunkSize = 6 * 1024 * 1024,
				...scopeOpts
			} = opts;
			return this.createMock(
				'POST',
				`/v7/release_asset(${assetId})/beginUpload`,
				{
					status: 200,
					body: {
						asset: {
							uuid,
							uploadParts: [
								{
									url: `${getIPv4Url()}${uploadPath}`,
									chunkSize,
									partNumber: 1,
								},
							],
						},
					},
				},
				scopeOpts,
			);
		},

		expectCommitUpload: (opts: ScopeOpts & { assetId: number }) => {
			const { assetId, ...scopeOpts } = opts;
			return this.createMock(
				'POST',
				`/v7/release_asset(${assetId})/commitUpload`,
				{ status: 200, body: { message: 'OK' } },
				scopeOpts,
			);
		},

		expectGetDeviceTypes: (opts?: ScopeOpts) =>
			this.createMock(
				'GET',
				/\/v\d+\/device_type($|\?)/,
				{
					status: 200,
					file: 'device-type-GET-v7.json',
				},
				opts,
			),

		expectGetContractOfOsRelease: async (
			opts: {
				deviceTypeSlug: string;
				rawVersion: string;
			} & ScopeOpts,
		) => {
			const { optional = false, persist = false, times } = opts;

			// Mock for sdk.models.os.getAllOsVersions which calls the application endpoint
			// with is_host: true and expands owns__release
			let builder = mockServer.forGet(/\/v\d+\/application/).matching((req) => {
				const decodedUrl = decodeURIComponent(req.url);
				return (
					decodedUrl.includes('is_host') && decodedUrl.includes('owns__release')
				);
			});

			if (persist) {
				builder = builder.always();
			}
			if (times && times > 0) {
				builder = builder.times(times);
			}

			const rule = await builder.thenReply(
				200,
				JSON.stringify({
					d: [
						{
							application_tag: [],
							is_for__device_type: [
								{
									slug: opts.deviceTypeSlug,
								},
							],
							owns__release: [
								{
									release_tag: [],
									id: 3783341,
									known_issue_list: null,
									raw_version: opts.rawVersion,
									variant: '',
									phase: null,
									contract: {
										name: `Balena OS for ${opts.deviceTypeSlug}`,
										type: 'sw.block',
										version: opts.rawVersion,
										provides: [
											...(opts.deviceTypeSlug === 'generic-amd64'
												? [
														{
															slug: 'secureboot',
															type: 'sw.feature',
														},
													]
												: []),
											{
												slug: 'balena-os',
												type: 'sw.os',
											},
											{
												slug: opts.deviceTypeSlug,
												type: 'hw.device-type',
											},
										],
										composedOf: ['balena-os', opts.deviceTypeSlug],
										description: `Balena OS for a ${opts.deviceTypeSlug}`,
									},
								},
							],
						},
					],
				}),
				{ 'Content-Type': 'application/json' },
			);

			if (!optional) {
				this.nonOptionalEndpoints.push({
					endpoint: rule,
					method: 'GET',
					path: /\/v\d+\/application/,
				});
			}

			return rule;
		},

		expectDownloadConfig: async (opts?: ScopeOpts) => {
			const { optional = false, persist = false, times } = opts || {};

			let builder = mockServer.forPost('/download-config');

			if (persist) {
				builder = builder.always();
			}
			if (times && times > 0) {
				builder = builder.times(times);
			}

			const rule = await builder.thenCallback(async (req) => {
				const body = await req.body.getJson();
				let deviceType = 'raspberrypi3';
				if (typeof body === 'object' && body && 'deviceType' in body) {
					deviceType = body.deviceType as string;
				}

				return {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						applicationId: 1301645,
						deviceType,
						userId: 43699,
						appUpdatePollInterval: 600000,
						listenPort: 48484,
						vpnPort: 443,
						apiEndpoint: 'https://api.balena-cloud.com',
						vpnEndpoint: 'vpn.balena-cloud.com',
						registryEndpoint: 'registry2.balena-cloud.com',
						deltaEndpoint: 'https://delta.balena-cloud.com',
						apiKey: 'nothingtoseehere',
					}),
				};
			});

			if (!optional) {
				this.nonOptionalEndpoints.push({
					endpoint: rule,
					method: 'POST',
					path: '/download-config',
				});
			}

			return rule;
		},

		expectGetDevice: async (
			opts: {
				fullUUID: string;
				shortUUID?: string;
				inaccessibleApp?: boolean;
				isConnectedToVpn?: boolean;
			} & ScopeOpts,
		) => {
			const {
				fullUUID,
				shortUUID,
				inaccessibleApp,
				isConnectedToVpn,
				optional = false,
				persist = false,
				times,
			} = opts;
			const id = 7654321;
			const providedUuid = shortUUID ?? fullUUID;

			let builder = mockServer.forGet(/\/v\d+\/device/);

			if (persist) {
				builder = builder.always();
			}
			if (times && times > 0) {
				builder = builder.times(times);
			}

			const rule = await builder.thenCallback((req) => {
				const decodedUrl = decodeURIComponent(req.url);
				// Check if the URL contains the provided UUID (short or full)
				if (
					decodedUrl.includes(providedUuid) ||
					decodedUrl.includes(fullUUID)
				) {
					return {
						status: 200,
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							d: [
								{
									id,
									uuid: fullUUID,
									is_connected_to_vpn: isConnectedToVpn,
									belongs_to__application: inaccessibleApp
										? []
										: [{ app_name: 'test', slug: 'org/test' }],
								},
							],
						}),
					};
				}
				return {
					status: 500,
				};
			});

			if (!optional) {
				this.nonOptionalEndpoints.push({
					endpoint: rule,
					method: 'GET',
					path: /\/v\d+\/device/,
				});
			}

			return rule;
		},

		expectGetConfigVars: (opts?: ScopeOpts) =>
			this.createMock(
				'GET',
				'/config/vars',
				{
					status: 200,
					body: {
						reservedNames: [],
						reservedNamespaces: [],
						invalidRegex: '/^\\d|\\W/',
						whiteListedNames: [],
						whiteListedNamespaces: [],
						blackListedNames: [],
						configVarSchema: [],
					},
				},
				opts,
			),

		expectGetAppEnvVars: (opts?: ScopeOpts) =>
			this.createMock(
				'GET',
				/\/v\d+\/application_environment_variable($|\?)/,
				{
					status: 200,
					body: {
						d: [
							{
								id: 120101,
								name: 'var1',
								value: 'var1-val',
							},
							{
								id: 120102,
								name: 'var2',
								value: '22',
							},
						],
					},
				},
				opts,
			),

		expectGetAppConfigVars: (opts?: ScopeOpts) =>
			this.createMock(
				'GET',
				/\/v\d+\/application_config_variable($|\?)/,
				{
					status: 200,
					body: {
						d: [
							{
								id: 120300,
								name: 'RESIN_SUPERVISOR_NATIVE_LOGGER',
								value: 'false',
							},
						],
					},
				},
				opts,
			),

		expectGetAppServiceVars: async (opts?: ScopeOpts) => {
			const { optional = false, persist = false, times } = opts || {};

			const appServiceVarsByService: { [key: string]: any } = {
				service1: {
					id: 120110,
					name: 'svar1',
					value: 'svar1-value',
					service: [{ id: 210110, service_name: 'service1' }],
				},
				service2: {
					id: 120111,
					name: 'svar2',
					value: 'svar2-value',
					service: [{ id: 210111, service_name: 'service2' }],
				},
			};

			let builder = mockServer.forGet(
				/\/v\d+\/service_environment_variable($|\?)/,
			);

			if (persist) {
				builder = builder.always();
			}
			if (times && times > 0) {
				builder = builder.times(times);
			}

			const rule = await builder.thenCallback((req) => {
				const url = req.url;
				const match = url.match(/service_name%20eq%20%27(.+?)%27/);
				const serviceName = match?.[1] || undefined;
				let varArray: any[];
				if (serviceName) {
					const varObj = appServiceVarsByService[serviceName];
					varArray = varObj ? [varObj] : [];
				} else {
					varArray = Object.values(appServiceVarsByService);
				}
				return {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ d: varArray }),
				};
			});

			if (!optional) {
				this.nonOptionalEndpoints.push({
					endpoint: rule,
					method: 'GET',
					path: /\/v\d+\/service_environment_variable($|\?)/,
				});
			}

			return rule;
		},

		expectGetDeviceEnvVars: (opts?: ScopeOpts) =>
			this.createMock(
				'GET',
				/\/v\d+\/device_environment_variable($|\?)/,
				{
					status: 200,
					body: {
						d: [
							{
								id: 120203,
								name: 'var3',
								value: 'var3-val',
							},
							{
								id: 120204,
								name: 'var4',
								value: '44',
							},
						],
					},
				},
				opts,
			),

		expectGetDeviceConfigVars: (opts?: ScopeOpts) =>
			this.createMock(
				'GET',
				/\/v\d+\/device_config_variable($|\?)/,
				{
					status: 200,
					body: {
						d: [
							{
								id: 120400,
								name: 'RESIN_SUPERVISOR_POLL_INTERVAL',
								value: '900900',
							},
						],
					},
				},
				opts,
			),

		expectGetDeviceServiceVars: async (opts?: ScopeOpts) => {
			const { optional = false, persist = false, times } = opts || {};

			const deviceServiceVarsByService: { [key: string]: any } = {
				service1: {
					id: 120120,
					name: 'svar3',
					value: 'svar3-value',
					service: [
						{
							id: 210110,
							service_name: 'service1',
						},
					],
				},
				service2: {
					id: 120121,
					name: 'svar4',
					value: 'svar4-value',
					service: [
						{
							id: 210111,
							service_name: 'service2',
						},
					],
				},
			};

			let builder = mockServer.forGet(
				/\/v\d+\/device_service_environment_variable($|\?)/,
			);

			if (persist) {
				builder = builder.always();
			}
			if (times && times > 0) {
				builder = builder.times(times);
			}

			const rule = await builder.thenCallback((req) => {
				const url = req.url;
				// Check if filtering by service name
				const match = url.match(/service_name%20eq%20%27(.+?)%27/);
				const serviceName = match?.[1] || undefined;
				let varArray: any[];
				if (serviceName) {
					const varObj = deviceServiceVarsByService[serviceName];
					varArray = varObj ? [varObj] : [];
				} else {
					varArray = Object.values(deviceServiceVarsByService);
				}
				return {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ d: varArray }),
				};
			});

			if (!optional) {
				this.nonOptionalEndpoints.push({
					endpoint: rule,
					method: 'GET',
					path: /\/v\d+\/device_service_environment_variable($|\?)/,
				});
			}

			return rule;
		},

		expectGetService: (
			opts: {
				serviceName: string;
				serviceId?: number;
			} & ScopeOpts,
		) => {
			const { serviceName, serviceId = 243768, ...scopeOpts } = opts;
			return this.createMock(
				'GET',
				/\/v\d+\/service/,
				{
					status: 200,
					body: {
						d: [{ id: serviceId, service_name: serviceName }],
					},
				},
				scopeOpts,
			);
		},

		expectGetServiceFromApp: (
			opts: {
				serviceName: string;
				serviceId?: number;
			} & ScopeOpts,
		) => {
			const { serviceName, serviceId = 243768 } = opts;
			return this.mockttp
				.forGet('/v7/application')
				.matching((req) => {
					const decodedUrl = decodeURIComponent(req.url);
					return /.*\$expand=service.*/.test(decodedUrl);
				})
				.thenReply(
					200,
					JSON.stringify({
						d: [{ service: [{ id: serviceId, service_name: serviceName }] }],
					}),
					{
						'Content-Type': 'application/json',
					},
				);
		},

		expectGetUser: (opts?: ScopeOpts) =>
			this.createMock(
				'GET',
				/^\/v7\/user/,
				{
					status: 200,
					body: {
						d: [
							{
								id: 99999,
								actor: { __id: 1234567 },
								username: 'gh_user',
								created_at: '2018-08-19T13:55:04.485Z',
							},
						],
					},
				},
				opts,
			),

		expectGetAuth: (opts?: ScopeOpts) =>
			this.createMock(
				'GET',
				'/auth/v1/token',
				{ status: 200, body: 'test-auth-token-for-registry' },
				opts,
			),

		expectPostImage: (opts?: ScopeOpts) =>
			this.createMock(
				'POST',
				/^\/v7\/image/,
				{ status: 201, file: 'image-POST-v7.json' },
				opts,
			),

		expectPostImageIsPartOfRelease: (opts?: ScopeOpts) =>
			this.createMock(
				'POST',
				/^\/v7\/image__is_part_of__release/,
				{ status: 200, file: 'image-is-part-of-release-POST-v7.json' },
				opts,
			),

		expectPostRelease: (
			opts?: {
				statusCode?: number;
				inspectRequest?: (uri: string, requestBody: any) => void;
			} & ScopeOpts,
		) => {
			const { statusCode = 200, inspectRequest, ...scopeOpts } = opts || {};

			if (inspectRequest) {
				return (async () => {
					let builder = mockServer.forPost(/^\/v7\/release($|\?)/);
					if (scopeOpts.persist) {
						builder = builder.always();
					}
					if (scopeOpts.times) {
						builder = builder.times(scopeOpts.times);
					}

					const rule = await builder.thenCallback(async (req) => {
						const body = await req.body.getJson();
						inspectRequest(req.url, body);
						const fileContent = await import('fs').then((fs) =>
							fs.promises.readFile(
								path.join(apiResponsePath, 'release-POST-v7.json'),
								'utf8',
							),
						);
						return {
							status: statusCode,
							headers: { 'Content-Type': 'application/json' },
							body: fileContent,
						};
					});

					if (!scopeOpts.optional) {
						this.nonOptionalEndpoints.push({
							endpoint: rule,
							method: 'POST',
							path: /^\/v7\/release($|\?)/,
						});
					}

					return rule;
				})();
			}

			return this.createMock(
				'POST',
				/^\/v7\/release($|\?)/,
				{ status: statusCode, file: 'release-POST-v7.json' },
				scopeOpts,
			);
		},

		expectPatchImage: (
			opts?: {
				replyBody?: string | object;
				statusCode?: number;
				inspectRequest?: (
					uri: string,
					requestBody: any,
				) => undefined | { status: number; body: any };
			} & ScopeOpts,
		) => {
			const {
				replyBody = {},
				statusCode = 200,
				inspectRequest,
				...scopeOpts
			} = opts || {};

			if (inspectRequest) {
				return (async () => {
					let builder = mockServer.forPatch(/\/v7\/image/);
					if (scopeOpts.persist) {
						builder = builder.always();
					}
					if (scopeOpts.times) {
						builder = builder.times(scopeOpts.times);
					}

					const rule = await builder.thenCallback(async (req) => {
						const body = await req.body.getJson();
						const customResponse = inspectRequest(req.url, body);

						// If inspectRequest returns a custom response, use it
						if (
							customResponse &&
							typeof customResponse === 'object' &&
							'status' in customResponse
						) {
							const responseBody = JSON.stringify(customResponse.body);
							return {
								statusCode: customResponse.status,
								headers: {
									'content-type': 'application/json',
									'content-length': String(responseBody.length),
								},
								body: responseBody,
							};
						}

						// Otherwise use the default response
						const responseBody = JSON.stringify(replyBody);
						return {
							statusCode: statusCode,
							headers: {
								'content-type': 'application/json',
								'content-length': String(responseBody.length),
							},
							body: responseBody,
						};
					});

					if (!scopeOpts.optional) {
						this.nonOptionalEndpoints.push({
							endpoint: rule,
							method: 'PATCH',
							path: /\/v7\/image/,
						});
					}

					return rule;
				})();
			}

			return this.createMock(
				'PATCH',
				/\/v7\/image/,
				{ status: statusCode, body: replyBody },
				scopeOpts,
			);
		},

		expectPatchRelease: (
			opts?: {
				inspectRequest?: (uri: string, requestBody: any) => void;
				statusCode?: number;
			} & ScopeOpts,
		) => {
			const { inspectRequest, statusCode = 200, ...scopeOpts } = opts || {};

			if (inspectRequest) {
				return (async () => {
					let builder = mockServer.forPatch(/^\/v7\/release/);
					if (scopeOpts.persist) {
						builder = builder.always();
					}
					if (scopeOpts.times) {
						builder = builder.times(scopeOpts.times);
					}

					const rule = await builder.thenCallback(async (req) => {
						const body = await req.body.getJson();
						inspectRequest(req.url, body);
						const bodyStr = '{}';
						return {
							status: statusCode,
							headers: { 'Content-Type': 'application/json' },
							body: bodyStr,
						};
					});

					if (!scopeOpts.optional) {
						this.nonOptionalEndpoints.push({
							endpoint: rule,
							method: 'PATCH',
							path: /^\/v7\/release/,
						});
					}

					return rule;
				})();
			}

			return this.createMock(
				'PATCH',
				/^\/v7\/release/,
				{ status: statusCode, body: '{}' },
				scopeOpts,
			);
		},

		expectPostImageLabel: (opts?: ScopeOpts) =>
			this.createMock(
				'POST',
				/^\/v7\/image_label/,
				{ status: 201, body: { id: 1 } },
				opts,
			),
	};
	public docker = {
		expectGetPing: (opts: ScopeOpts = {}) =>
			this.createMock('GET', '/_ping', { status: 200, body: 'OK' }, opts),

		expectGetInfo: (
			opts: {
				OperatingSystem?: string;
				Architecture?: string;
			} & ScopeOpts = {},
		) => {
			const { OperatingSystem = 'Docker for Mac', ...scopeOpts } = opts;
			const body = {
				KernelVersion: '4.9.93-linuxkit-aufs',
				OperatingSystem,
				OSType: 'linux',
				Architecture: 'x86_64',
			};
			return this.createMock('GET', '/info', { status: 200, body }, scopeOpts);
		},

		expectGetVersion: (
			opts: {
				Engine?: string;
				ApiVersion?: string;
			} & ScopeOpts = {},
		) => {
			const body = {
				Platform: {
					Name: '',
				},
				Version: '18.06.1-ce',
				ApiVersion: '1.38',
				MinAPIVersion: '1.12',
				GitCommit: 'e68fc7a',
				GoVersion: 'go1.10.3',
				Os: 'linux',
				Arch: 'amd64',
				KernelVersion: '4.9.93-linuxkit-aufs',
				Experimental: true,
				BuildTime: '2018-08-21T17:29:02.000000000+00:00',
			};
			return this.createMock('GET', '/version', { status: 200, body }, opts);
		},

		expectPostBuild: async (opts: {
			optional?: boolean;
			persist?: boolean;
			responseBody: any;
			responseCode: number;
			tag: string;
			checkURI: (uri: string) => Promise<void> | void;
			checkBuildRequestBody: (requestBody: string) => Promise<void>;
		}) => {
			const { optional = false, persist = false } = opts;
			let builder = mockServer.forPost().matching((req) => {
				const decodedUrl = decodeURIComponent(req.url);
				let pathOnly = decodedUrl;
				try {
					const url = new URL(decodedUrl, 'http://localhost');
					pathOnly = url.pathname + url.search;
				} catch {
					pathOnly = decodedUrl;
				}
				// Check if it's a build request with the correct tag
				if (!pathOnly.startsWith('/build?')) {
					return false;
				}
				return (
					pathOnly.includes(`t=${opts.tag}`) ||
					pathOnly.includes(`t=${encodeURIComponent(opts.tag)}`)
				);
			});

			if (persist) {
				builder = builder.always();
			}

			const rule = await builder.thenCallback(async (req) => {
				await opts.checkURI(req.url);
				const body = await req.body.getText();
				await opts.checkBuildRequestBody(body || '');
				return {
					status: opts.responseCode,
					headers: { 'Content-Type': 'application/json' },
					body: opts.responseBody,
				};
			});

			if (!optional) {
				this.nonOptionalEndpoints.push({
					endpoint: rule,
					method: 'POST',
					path: '/build',
				});
			}

			return rule;
		},

		expectGetImages: (opts: ScopeOpts = {}) => {
			const body = [{ Id: 'sha256:abcd1234', RepoTags: ['test:latest'] }];
			return this.createMock('GET', /^\/images\//, { status: 200, body }, opts);
		},

		expectDeleteImages: (opts: ScopeOpts = {}) => {
			const body = [
				{ Untagged: 'basic_main:latest' },
				{
					Untagged:
						'registry2.balena-cloud.com/v2/c089c421fb2336d0475166fbf3d0f9fa@sha256:444a5e0c57eed51f5e752b908cb95188c25a0476fc6e5f43e5113edfc4d07199',
				},
			];
			return this.createMock(
				'DELETE',
				/^\/images\//,
				{ status: 200, body },
				opts,
			);
		},

		expectPostImagesTag: (opts: ScopeOpts = {}) =>
			this.createMock('POST', /\/images\/.+?\/tag/, { status: 201 }, opts),

		expectPostImagesPush: (opts: ScopeOpts = {}) =>
			this.createMock(
				'POST',
				/^\/images\/.+?\/push/,
				{ status: 200, file: '../docker-response/images-push-POST.json' },
				opts,
			),

		expectGetManifestBusybox: (opts: ScopeOpts = {}) =>
			this.createMock(
				'GET',
				'/distribution/busybox/json',
				{
					status: 200,
					file: '../docker-response/distribution-busybox-GET.json',
				},
				opts,
			),

		expectGetManifestRpi3Alpine: (opts: ScopeOpts = {}) =>
			this.createMock(
				'GET',
				'/distribution/balenalib/raspberrypi3-alpine/json',
				{
					status: 200,
					file: '../docker-response/distribution-rpi3alpine.json',
				},
				opts,
			),

		expectGetManifestNucAlpine: (opts: ScopeOpts = {}) =>
			this.createMock(
				'GET',
				'/distribution/balenalib/nuc-alpine/json',
				{ status: 200, file: '../docker-response/distribution-nucalpine.json' },
				opts,
			),
	};

	public builder = {
		expectPostBuild: async (opts: {
			optional?: boolean;
			persist?: boolean;
			responseBody: any;
			responseCode: number;
			checkURI: (uri: string) => Promise<void> | void;
			checkBuildRequestBody: (requestBody: string | Buffer) => Promise<void>;
		}) => {
			const { optional = false, persist = false } = opts;
			let builder = mockServer.forPost(/^\/v3\/build/);

			if (persist) {
				builder = builder.always();
			}

			const rule = await builder.thenCallback(async (req) => {
				await opts.checkURI(req.url);
				const bodyBuffer = req.body.buffer;
				const zlib = await import('zlib');
				const { promisify } = await import('util');
				const gunzipAsync = promisify(zlib.gunzip);
				const gunzipped = await gunzipAsync(bodyBuffer);
				await opts.checkBuildRequestBody(gunzipped);
				return {
					status: opts.responseCode,
					headers: { 'Content-Type': 'application/json' },
					body: opts.responseBody,
				};
			});

			if (!optional) {
				this.nonOptionalEndpoints.push({
					endpoint: rule,
					method: 'POST',
					path: /^\/v3\/build/,
				});
			}

			return rule;
		},
	};

	public supervisor = {
		expectGetPing: async (opts: ScopeOpts = {}) => {
			const { optional = false, persist = false, times } = opts;
			let builder = mockServer.forGet('/ping');

			if (persist) {
				builder = builder.always();
			}
			if (times && times > 0) {
				builder = builder.times(times);
			}

			// Return plain text "OK" without JSON content-type
			const rule = await builder.thenReply(200, 'OK', {
				'Content-Type': 'text/plain',
			});

			if (!optional) {
				this.nonOptionalEndpoints.push({
					endpoint: rule,
					method: 'GET',
					path: '/ping',
				});
			}

			return rule;
		},

		expectGetLogs: async (opts: ScopeOpts = {}) => {
			const { optional = false, persist = false, times } = opts;
			const chunks = [
				'',
				'{"message":"Streaming logs","isSystem":true}',
				'{"serviceName":"bar","serviceId":1,"imageId":1,"isStdout":true,"timestamp":1591991625223,"message":"bar 8 (332) Linux 4e3f81149d71 4.19.75 #1 SMP PREEMPT Mon Mar 23 11:50:49 UTC 2020 aarch64 GNU/Linux"}',
				'{"serviceName":"foo","serviceId":2,"imageId":2,"isStdout":true,"timestamp":1591991628757,"message":"foo 8 (200) Linux cc5df60d89ee 4.19.75 #1 SMP PREEMPT Mon Mar 23 11:50:49 UTC 2020 aarch64 GNU/Linux"}',
			].map((l) => `${l}\n`);
			let chunkCount = 0;
			const chunkedStream = new Readable({
				read(_size) {
					setTimeout(() => {
						this.push(
							chunkCount === chunks.length ? null : chunks[chunkCount++],
						);
					}, 10);
				},
			});
			let builder = mockServer.forGet('/v2/local/logs');
			if (persist) {
				builder = builder.always();
			}
			if (times && times > 0) {
				builder = builder.times(times);
			}
			const rule = await builder.thenStream(200, chunkedStream, {
				'Content-Type': 'application/x-ndjson',
			});

			if (!optional) {
				this.nonOptionalEndpoints.push({
					endpoint: rule,
					method: 'GET',
					path: '/v2/local/logs',
				});
			}

			return rule;
		},
	};
}
