import * as mockttp from 'mockttp';
import * as path from 'path';
import * as fs from 'fs';
import { MOCKTTP_PORT } from './config-tests';

const apiResponsePath = path.normalize(
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

	public async start() {
		mockServer = mockttp.getLocal();
		await mockServer.start(MOCKTTP_PORT);
		const { getSdk } = await import('balena-sdk');
		const sdk = getSdk({
			apiUrl: mockServer.url,
		});
		const lazyModule = await import('../build/utils/lazy');
		// @ts-expect-error - Overriding read-only property for testing
		lazyModule.getBalenaSdk = () => sdk;
	}

	public async stop() {
		await mockServer.stop();
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
			const decodedUrl = decodeURIComponent(req.url);
			if (typeof $path === 'string') {
				const decodedPath = decodeURIComponent($path);
				return decodedUrl.includes(decodedPath);
			} else {
				// RegExp - test against the decoded URL
				return $path.test(decodedUrl);
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

		expectGetApplication: (opts?: ScopeOpts) =>
			this.createMock(
				'GET',
				/\/v7\/application($|[(?])/,
				{
					status: 200,
					file: 'application-GET-v7-expanded-app-type.json',
				},
				opts,
			),

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
										href: `${mockServer.url}/download/release-asset-${assetId}.bin`,
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
										href: `${mockServer.url}/download/release-asset-456.bin`,
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
									href: `${mockServer.url}/download/release-asset-${assetId}.bin`,
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
									url: `${mockServer.url}${uploadPath}`,
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

		expectGetDevice: async (
			opts: {
				fullUUID: string;
				shortUUID?: string;
				inaccessibleApp?: boolean;
				isOnline?: boolean;
			} & ScopeOpts,
		) => {
			const {
				fullUUID,
				shortUUID,
				inaccessibleApp,
				isOnline,
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
									is_online: isOnline,
									belongs_to__application: inaccessibleApp
										? []
										: [{ app_name: 'test', slug: 'org/test' }],
								},
							],
						}),
					};
				}
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
						invalidRegex: '/d|W/',
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
					service_install: [
						{
							installs__service: [{ id: 210110, service_name: 'service1' }],
						},
					],
				},
				service2: {
					id: 120121,
					name: 'svar4',
					value: 'svar4-value',
					service_install: [
						{
							installs__service: [{ id: 210111, service_name: 'service2' }],
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
			// Returns service info for service validation (matching old nock mock)
			return this.createMock(
				'GET',
				/\/v\d+\/service($|\?)/,
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
	};
}
