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

		let builder = methodMap[method]($path);

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
				/^\/v7\/release_asset($|\?)/,
				{ status: 201, body: { id: assetId, asset_key: assetKey } },
				scopeOpts,
			);
		},

		expectPatchReleaseAsset: (opts: ScopeOpts & { assetId: number }) => {
			const { assetId, ...scopeOpts } = opts;
			return this.createMock(
				'PATCH',
				/^\/v7\/release_asset/,
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
	};
}
