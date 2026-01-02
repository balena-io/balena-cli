/**
 * @license
 * Copyright 2019-2021 Balena Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as path from 'path';

import type { ScopeOpts } from './nock-mock';
import { NockMock } from './nock-mock';

export const apiResponsePath = path.normalize(
	path.join(__dirname, '..', 'test-data', 'api-response'),
);

const jHeader = { 'Content-Type': 'application/json' };

export class BalenaAPIMock extends NockMock {
	constructor() {
		super(/api\.balena-cloud\.com/);
	}

	public expectGetApplication({
		notFound = false,
		optional = false,
		persist = false,
		times = undefined as number | undefined,
		expandArchitecture = false,
	} = {}) {
		const interceptor = this.optGet(/^\/v7\/application($|[(?])/, {
			optional,
			persist,
			times,
		});
		if (notFound) {
			interceptor.reply(200, { d: [] });
		} else {
			interceptor.replyWithFile(
				200,
				path.join(
					apiResponsePath,
					!expandArchitecture
						? 'application-GET-v7-expanded-app-type.json'
						: 'application-GET-v7-expanded-app-type-cpu-arch.json',
				),
				jHeader,
			);
		}
	}

	public expectDownloadConfig(opts: ScopeOpts = {}) {
		this.optPost('/download-config', opts).reply(200, (_uri, body) => {
			let deviceType = 'raspberrypi3';
			if (typeof body === 'object' && 'deviceType' in body) {
				deviceType = body.deviceType;
			}
			return JSON.parse(`{
					"applicationId":1301645,
					"deviceType":"${deviceType}",
					"userId":43699,
					"appUpdatePollInterval":600000,
					"listenPort":48484,
					"vpnPort":443,
					"apiEndpoint":"https://api.balena-cloud.com",
					"vpnEndpoint":"vpn.balena-cloud.com",
					"registryEndpoint":"registry2.balena-cloud.com",
					"deltaEndpoint":"https://delta.balena-cloud.com",
					"apiKey":"nothingtoseehere"
				}`);
		});
	}

	public expectApplicationProvisioning(opts: ScopeOpts = {}) {
		// The endpoint changed in balena-sdk v15.45.0:
		// before: '/api-key/application/${applicationId}/provisioning'
		// after:  '/api-key/v1/'
		this.optPost(/^\/api-key\/v[0-9]\/?$/, opts).reply(200, 'dummykey');
	}

	public expectGetAuth(opts: ScopeOpts = {}) {
		this.optGet(/^\/auth\/v1\//, opts).reply(200, {
			token: 'test',
		});
	}

	public expectGetRelease({
		notFound = false,
		optional = false,
		persist = false,
		times = undefined as number | undefined,
	} = {}) {
		const interceptor = this.optGet(/^\/v7\/release($|[(?])/, {
			persist,
			optional,
			times,
		});
		if (notFound) {
			interceptor.reply(200, { d: [] });
		} else {
			this.optGet(/^\/v7\/release($|[(?])/, {
				persist,
				optional,
			}).replyWithFile(
				200,
				path.join(apiResponsePath, 'release-GET-v7.json'),
				jHeader,
			);
		}
	}

	/**
	 * Mocks balena-release call
	 */
	public expectPatchRelease({
		replyBody = 'OK',
		statusCode = 200,
		inspectRequest = this.inspectNoOp,
		optional = false,
		persist = false,
		times = undefined as number | undefined,
	}) {
		this.optPatch(/^\/v7\/release($|[(?])/, { optional, persist, times }).reply(
			statusCode,
			this.getInspectedReplyBodyFunction(inspectRequest, replyBody),
		);
	}

	/**
	 * Mocks balena-release call
	 */
	public expectPostRelease({
		statusCode = 200,
		inspectRequest = this.inspectNoOp,
		optional = false,
		persist = false,
		times = undefined as number | undefined,
	}) {
		this.optPost(/^\/v7\/release($|[(?])/, { optional, persist, times }).reply(
			statusCode,
			this.getInspectedReplyFileFunction(
				inspectRequest,
				path.join(apiResponsePath, 'release-POST-v7.json'),
			),
			jHeader,
		);
	}

	/**
	 * Mocks balena-release call
	 */
	public expectPatchImage({
		replyBody = 'OK',
		statusCode = 200,
		inspectRequest = this.inspectNoOp,
		optional = false,
		persist = false,
		times = undefined as number | undefined,
	}) {
		this.optPatch(/^\/v7\/image($|[(?])/, { optional, persist, times }).reply(
			statusCode,
			this.getInspectedReplyBodyFunction(inspectRequest, replyBody),
		);
	}

	/**
	 * Mocks balena-release call
	 */
	public expectPostImage(opts: ScopeOpts = {}) {
		this.optPost(/^\/v7\/image($|[(?])/, opts).replyWithFile(
			201,
			path.join(apiResponsePath, 'image-POST-v7.json'),
			jHeader,
		);
	}

	/**
	 * Mocks balena-release call
	 */
	public expectPostImageLabel(opts: ScopeOpts = {}) {
		this.optPost(/^\/v7\/image_label($|[(?])/, opts).replyWithFile(
			201,
			path.join(apiResponsePath, 'image-label-POST-v7.json'),
			jHeader,
		);
	}

	/**
	 * Mocks balena-release call
	 */
	public expectPostImageIsPartOfRelease(opts: ScopeOpts = {}) {
		this.optPost(
			/^\/v7\/image__is_part_of__release($|[(?])/,
			opts,
		).replyWithFile(
			200,
			path.join(apiResponsePath, 'image-is-part-of-release-POST-v7.json'),
			jHeader,
		);
	}
	public expectGetReleaseWithReleaseAssets({
		empty = false,
		optional = false,
		persist = false,
		times = undefined as number | undefined,
	} = {}) {
		const interceptor = this.optGet(/^\/v7\/release($|[(?])/, {
			persist,
			optional,
			times,
		});

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

		interceptor.reply(200, {
			d: [
				{
					id: 142334,
					release_asset: releaseAssets,
				},
			],
		});
	}

	public expectDeleteReleaseAsset({
		assetKey,
		releaseId = 142334,
		optional = false,
		persist = false,
		times = undefined as number | undefined,
	}: {
		assetKey: string;
		releaseId?: number;
		optional?: boolean;
		persist?: boolean;
		times?: number;
	}) {
		const interceptor = this.optDelete(
			`/v7/release_asset(release=${releaseId},asset_key=%27${assetKey}%27)`,
			{
				optional,
				persist,
				times,
			},
		);
		interceptor.reply(200);
	}

	public expectGetReleaseAssetMissingOnce({
		assetId = 456,
		optional = false,
		persist = false,
		times = undefined as number | undefined,
	}: {
		assetKey?: string;
		releaseId?: number;
		found?: boolean;
		assetId?: number;
		optional?: boolean;
		persist?: boolean;
		times?: number;
	} = {}) {
		const interceptor = this.optGet(/^\/v7\/release_asset/, {
			optional,
			persist,
			times,
		});

		let found = false;
		interceptor.reply(() => {
			if (!found) {
				found = true;
				return [200, { d: [] }];
			}
			return [
				200,
				{
					d: [
						{
							id: assetId,
							asset: {
								href: `https://balena-asset-downloads.s3.amazonaws.com/release-asset-${assetId}.bin`,
								size: 1024,
								content_type: 'application/octet-stream',
							},
						},
					],
				},
			];
		});
	}

	public expectGetReleaseAsset({
		found = true,
		assetId,
		optional = false,
		persist = false,
		times = undefined as number | undefined,
	}: {
		assetKey?: string;
		releaseId?: number;
		found?: boolean;
		assetId?: number;
		optional?: boolean;
		persist?: boolean;
		times?: number;
	} = {}) {
		const interceptor = this.optGet(/^\/v7\/release_asset/, {
			optional,
			persist,
			times,
		});

		if (found && assetId) {
			interceptor.reply(200, {
				d: [
					{
						id: assetId,
						asset: {
							href: `https://balena-asset-downloads.s3.amazonaws.com/release-asset-${assetId}.bin`,
							size: 1024,
							content_type: 'application/octet-stream',
						},
					},
				],
			});
		} else if (found) {
			interceptor.reply(200, {
				d: [
					{
						id: 456,
						asset: {
							href: `https://balena-asset-downloads.s3.amazonaws.com/release-asset-456.bin`,
							size: 1024,
							content_type: 'application/octet-stream',
						},
					},
				],
			});
		} else {
			interceptor.reply(200, { d: [] });
		}
	}

	public expectPostReleaseAsset({
		assetKey,
		assetId = 123,
		optional = false,
		persist = false,
		times = undefined as number | undefined,
	}: {
		assetKey?: string;
		assetId?: number;
		optional?: boolean;
		persist?: boolean;
		times?: number;
	} = {}) {
		// Make regex more specific to avoid capturing beginUpload/commitUpload requests
		const interceptor = this.optPost(/^\/v7\/release_asset($|\?)/, {
			optional,
			persist,
			times,
		});
		interceptor.reply(201, { id: assetId, asset_key: assetKey });
	}

	public expectPatchReleaseAsset({
		assetId,
		optional = false,
		persist = false,
		times = undefined as number | undefined,
	}: {
		assetId: number;
		optional?: boolean;
		persist?: boolean;
		times?: number;
	}) {
		const interceptor = this.optPatch(/^\/v7\/release_asset/, {
			optional,
			persist,
			times,
		});
		interceptor.reply(200, { id: assetId });
	}

	public expectBeginUpload({
		assetId,
		uuid = 'test-upload-uuid',
		uploadUrl = 'https://test-upload.example.com/part1',
		chunkSize = 6 * 1024 * 1024,
		optional = false,
		persist = false,
		times = undefined as number | undefined,
	}: {
		assetId: number;
		uuid?: string;
		uploadUrl?: string;
		chunkSize?: number;
		optional?: boolean;
		persist?: boolean;
		times?: number;
	}) {
		const interceptor = this.optPost(
			`/v7/release_asset(${assetId})/beginUpload`,
			{
				optional,
				persist,
				times,
			},
		);
		interceptor.reply(200, {
			asset: {
				uuid,
				uploadParts: [
					{
						url: uploadUrl,
						chunkSize,
						partNumber: 1,
					},
				],
			},
		});
	}

	public expectCommitUpload({
		assetId,
		optional = false,
		persist = false,
		times = undefined as number | undefined,
	}: {
		assetId: number;
		optional?: boolean;
		persist?: boolean;
		times?: number;
	}) {
		const interceptor = this.optPost(
			`/v7/release_asset(${assetId})/commitUpload`,
			{
				optional,
				persist,
				times,
			},
		);
		interceptor.reply(200, 'OK');
	}

	public expectGetDevice(opts: {
		fullUUID: string;
		shortUUID?: string;
		inaccessibleApp?: boolean;
		isConnectedToVpn?: boolean;
		optional?: boolean;
		persist?: boolean;
	}) {
		const id = 7654321;
		const providedUuid = opts.shortUUID ?? opts.fullUUID;
		this.optGet(
			providedUuid.length !== 32
				? /^\/v\d+\/device($|\?)/
				: /^\/v\d+\/device\(uuid=%27[0-9a-f]{32}%27\)/,
			opts,
		).reply(200, {
			d: [
				{
					id,
					uuid: opts.fullUUID,
					is_connected_to_vpn: opts.isConnectedToVpn,
					belongs_to__application: opts.inaccessibleApp
						? []
						: [{ app_name: 'test', slug: 'org/test' }],
				},
			],
		});
	}

	public expectGetDeviceStatus(opts: ScopeOpts = {}) {
		this.optGet(
			/^\/v\d+\/device\?.+&\$select=overall_status$/,
			opts,
		).replyWithFile(
			200,
			path.join(apiResponsePath, 'device-status.json'),
			jHeader,
		);
	}

	public expectGetAppEnvVars(opts: ScopeOpts = {}) {
		this.optGet(/^\/v\d+\/application_environment_variable($|\?)/, opts).reply(
			200,
			{
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
		);
	}

	public expectGetAppConfigVars(opts: ScopeOpts = {}) {
		this.optGet(/^\/v\d+\/application_config_variable($|\?)/, opts).reply(200, {
			d: [
				{
					id: 120300,
					name: 'RESIN_SUPERVISOR_NATIVE_LOGGER',
					value: 'false',
				},
			],
		});
	}

	public expectGetAppServiceVars(opts: ScopeOpts = {}) {
		this.optGet(/^\/v\d+\/service_environment_variable($|\?)/, opts).reply(
			function (uri, _requestBody) {
				const match = uri.match(/service_name%20eq%20%27(.+?)%27/);
				const serviceName = match?.[1] ?? undefined;
				let varArray: any[];
				if (serviceName) {
					const varObj = appServiceVarsByService[serviceName];
					varArray = varObj ? [varObj] : [];
				} else {
					varArray = Object.values(appServiceVarsByService);
				}
				return [200, { d: varArray }];
			},
		);
	}

	public expectGetDeviceEnvVars(opts: ScopeOpts = {}) {
		this.optGet(/^\/v\d+\/device_environment_variable($|\?)/, opts).reply(200, {
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
		});
	}

	public expectGetDeviceConfigVars(opts: ScopeOpts = {}) {
		this.optGet(/^\/v\d+\/device_config_variable($|\?)/, opts).reply(200, {
			d: [
				{
					id: 120400,
					name: 'RESIN_SUPERVISOR_POLL_INTERVAL',
					value: '900900',
				},
			],
		});
	}

	public expectGetDeviceServiceVars(opts: ScopeOpts = {}) {
		this.optGet(
			/^\/v\d+\/device_service_environment_variable($|\?)/,
			opts,
		).reply(function (uri, _requestBody) {
			const match = uri.match(/service_name%20eq%20%27(.+?)%27/);
			const serviceName = match?.[1] ?? undefined;
			let varArray: any[];
			if (serviceName) {
				const varObj = deviceServiceVarsByService[serviceName];
				varArray = varObj ? [varObj] : [];
			} else {
				varArray = Object.values(deviceServiceVarsByService);
			}
			return [200, { d: varArray }];
		});
	}

	public expectGetConfigDeviceTypes(opts: ScopeOpts = {}) {
		this.optGet('/device-types/v1', opts).replyWithFile(
			200,
			path.join(apiResponsePath, 'device-types-GET-v1.json'),
			jHeader,
		);
	}

	public expectGetDeviceTypes(opts: ScopeOpts = {}) {
		this.optGet(/^\/v\d+\/device_type($|\?)/, opts).replyWithFile(
			200,
			path.join(apiResponsePath, 'device-type-GET-v7.json'),
			jHeader,
		);
	}

	public expectGetConfigVars(opts: ScopeOpts = {}) {
		this.optGet('/config/vars', opts).reply(200, {
			reservedNames: [],
			reservedNamespaces: [],
			invalidRegex: '/^d|W/',
			whiteListedNames: [],
			whiteListedNamespaces: [],
			blackListedNames: [],
			configVarSchema: [],
		});
	}

	public expectGetService(opts: {
		optional?: boolean;
		persist?: boolean;
		serviceId?: number;
		serviceName: string;
	}) {
		const serviceId = opts.serviceId ?? 243768;
		this.optGet(/^\/v\d+\/service(\(\w+=\d+,\w+=%27\w+%27\))?$/, opts).reply(
			200,
			{
				d: [{ id: serviceId, service_name: opts.serviceName }],
			},
		);
	}

	public expectGetServiceFromApp(opts: {
		optional?: boolean;
		persist?: boolean;
		serviceId?: number;
		serviceName: string;
	}) {
		const serviceId = opts.serviceId ?? 243768;
		this.optGet(/^\/v7\/application($|\?).*\$expand=service.*/, opts).reply(
			200,
			{
				d: [{ service: [{ id: serviceId, service_name: opts.serviceName }] }],
			},
		);
	}

	public expectGetContractOfOsRelease(opts: {
		optional?: boolean;
		persist?: boolean;
		deviceTypeSlug: string;
		rawVersion: string;
	}) {
		const rawVersion = opts.rawVersion.replaceAll('.', '\\.');
		const regexp = new RegExp(
			`^\\/v7\\/application\\?\\$select=is_for__device_type&\\$expand=application_tag\\(\\$select=tag_key,value\\),is_for__device_type\\(\\$select=slug\\),owns__release\\(\\$select=id,known_issue_list,raw_version,variant,phase,contract;\\$expand=release_tag\\(\\$select=tag_key,value\\);\\$filter=raw_version%20eq%20%27${rawVersion}%27\\)&\\$filter=\\(is_host%20eq%20true\\)%20and%20\\(is_for__device_type\\/any\\(dt:dt\\/slug%20in%20\\(%27${opts.deviceTypeSlug}%27\\)\\)\\)`,
		);
		this.optGet(regexp, opts).reply(200, () => {
			console.info(`*** this`);
			return {
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
			};
		});
	}

	/**
	 * Mocks balena-release call
	 */
	public expectGetUser(opts: ScopeOpts = {}) {
		this.optGet(/^\/v7\/user/, opts).reply(200, {
			d: [
				{
					id: 99999,
					actor: { __id: 1234567 },
					username: 'gh_user',
					created_at: '2018-08-19T13:55:04.485Z',
				},
			],
		});
	}

	// User details are cached in the SDK
	// so often we don't know if we can expect the whoami request
	public expectGetWhoAmI(opts: ScopeOpts = { optional: true }) {
		this.optGet('/actor/v1/whoami', opts).reply(200, {
			id: 1234,
			actorType: 'user',
			actorTypeId: 99999,
			username: 'gh_user',
			email: 'testuser@test.com',
		});
	}

	public expectDeviceWhoAmI(opts: ScopeOpts = { optional: true }) {
		this.optGet('/actor/v1/whoami', opts).reply(200, {
			id: 1235,
			actorType: 'device',
			actorTypeId: 88888,
			uuid: 'a11dc1acd31b623a0e4e084a6cf13aaa',
		});
	}

	public expectApplicationWhoAmI(opts: ScopeOpts = { optional: true }) {
		this.optGet('/actor/v1/whoami', opts).reply(200, {
			id: 1236,
			actorType: 'application',
			actorTypeId: 77777,
			slug: 'mytestorf/mytestfleet',
		});
	}

	public expectWhoAmIFail(opts: ScopeOpts = { optional: true }) {
		this.optGet('/actor/v1/whoami', opts).reply(401);
	}
}

const appServiceVarsByService: { [key: string]: any } = {
	service1: {
		id: 120110,
		name: 'svar1',
		value: 'svar1-value',
		service: [
			{
				id: 210110,
				service_name: 'service1',
			},
		],
	},
	service2: {
		id: 120111,
		name: 'svar2',
		value: 'svar2-value',
		service: [
			{
				id: 210111,
				service_name: 'service2',
			},
		],
	},
};

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
