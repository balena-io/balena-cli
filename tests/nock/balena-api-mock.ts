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

import _ from 'lodash';
import * as path from 'path';

import type { ScopeOpts } from './nock-mock';
import { NockMock } from './nock-mock';

export const apiResponsePath = path.normalize(
	path.join(import.meta.dirname, '..', 'test-data', 'api-response'),
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
		const interceptor = this.optGet(/^\/v6\/application($|[(?])/, {
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
						? 'application-GET-v6-expanded-app-type.json'
						: 'application-GET-v6-expanded-app-type-cpu-arch.json',
				),
				jHeader,
			);
		}
	}

	public expectDownloadConfig(opts: ScopeOpts = {}) {
		this.optPost('/download-config', opts).reply(
			200,
			JSON.parse(`{
				"applicationId":1301645,
				"deviceType":"raspberrypi3",
				"userId":43699,
				"appUpdatePollInterval":600000,
				"listenPort":48484,
				"vpnPort":443,
				"apiEndpoint":"https://api.balena-cloud.com",
				"vpnEndpoint":"vpn.balena-cloud.com",
				"registryEndpoint":"registry2.balena-cloud.com",
				"deltaEndpoint":"https://delta.balena-cloud.com",
				"mixpanelToken":"",
				"apiKey":"nothingtoseehere"
			}`),
		);
	}

	public expectApplicationProvisioning(opts: ScopeOpts = {}) {
		// The endpoint changed in balena-sdk v15.45.0:
		// before: '/api-key/application/${applicationId}/provisioning'
		// after:  '/api-key/v1/'
		this.optPost(/^\/api-key\/v[0-9]\/?$/, opts).reply(200, 'dummykey');
	}

	public expectGetMyApplication(opts: ScopeOpts = {}) {
		this.optGet(/^\/v6\/my_application($|[(?])/, opts).reply(
			200,
			JSON.parse(`{"d": [{
				"organization": [{ "handle": "bob", "__metadata": {} }],
				"id": 1301645,
				"__metadata": { "uri": "/resin/my_application(@id)?@id=1301645" }}]}
			`),
		);
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
		const interceptor = this.optGet(/^\/v6\/release($|[(?])/, {
			persist,
			optional,
			times,
		});
		if (notFound) {
			interceptor.reply(200, { d: [] });
		} else {
			this.optGet(/^\/v6\/release($|[(?])/, {
				persist,
				optional,
			}).replyWithFile(
				200,
				path.join(apiResponsePath, 'release-GET-v6.json'),
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
		this.optPatch(/^\/v6\/release($|[(?])/, { optional, persist, times }).reply(
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
		this.optPost(/^\/v6\/release($|[(?])/, { optional, persist, times }).reply(
			statusCode,
			this.getInspectedReplyFileFunction(
				inspectRequest,
				path.join(apiResponsePath, 'release-POST-v6.json'),
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
		this.optPatch(/^\/v6\/image($|[(?])/, { optional, persist, times }).reply(
			statusCode,
			this.getInspectedReplyBodyFunction(inspectRequest, replyBody),
		);
	}

	/**
	 * Mocks balena-release call
	 */
	public expectPostImage(opts: ScopeOpts = {}) {
		this.optPost(/^\/v6\/image($|[(?])/, opts).replyWithFile(
			201,
			path.join(apiResponsePath, 'image-POST-v6.json'),
			jHeader,
		);
	}

	/**
	 * Mocks balena-release call
	 */
	public expectPostImageLabel(opts: ScopeOpts = {}) {
		this.optPost(/^\/v6\/image_label($|[(?])/, opts).replyWithFile(
			201,
			path.join(apiResponsePath, 'image-label-POST-v6.json'),
			jHeader,
		);
	}

	/**
	 * Mocks balena-release call
	 */
	public expectPostImageIsPartOfRelease(opts: ScopeOpts = {}) {
		this.optPost(
			/^\/v6\/image__is_part_of__release($|[(?])/,
			opts,
		).replyWithFile(
			200,
			path.join(apiResponsePath, 'image-is-part-of-release-POST-v6.json'),
			jHeader,
		);
	}

	public expectGetDevice(opts: {
		fullUUID: string;
		shortUUID?: string;
		inaccessibleApp?: boolean;
		isOnline?: boolean;
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
					is_online: opts.isOnline,
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
				const serviceName = (match && match[1]) || undefined;
				let varArray: any[];
				if (serviceName) {
					const varObj = appServiceVarsByService[serviceName];
					varArray = varObj ? [varObj] : [];
				} else {
					varArray = _.map(appServiceVarsByService, (value) => value);
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
			const serviceName = (match && match[1]) || undefined;
			let varArray: any[];
			if (serviceName) {
				const varObj = deviceServiceVarsByService[serviceName];
				varArray = varObj ? [varObj] : [];
			} else {
				varArray = _.map(deviceServiceVarsByService, (value) => value);
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
			path.join(apiResponsePath, 'device-type-GET-v6.json'),
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
		const serviceId = opts.serviceId || 243768;
		this.optGet(/^\/v\d+\/service($|\?)/, opts).reply(200, {
			d: [{ id: serviceId, service_name: opts.serviceName }],
		});
	}

	public expectGetServiceFromApp(opts: {
		optional?: boolean;
		persist?: boolean;
		serviceId?: number;
		serviceName: string;
	}) {
		const serviceId = opts.serviceId || 243768;
		this.optGet(/^\/v6\/application($|\?).*\$expand=service.*/, opts).reply(
			200,
			{
				d: [{ service: [{ id: serviceId, service_name: opts.serviceName }] }],
			},
		);
	}

	public expectPostService409(opts: ScopeOpts = {}) {
		this.optPost(/^\/v\d+\/service$/, opts).reply(
			409,
			'Unique key constraint violated',
		);
	}

	/**
	 * Mocks balena-release call
	 */
	public expectGetUser(opts: ScopeOpts = {}) {
		this.optGet(/^\/v6\/user/, opts).reply(200, {
			d: [
				{
					id: 99999,
					actor: 1234567,
					username: 'gh_user',
					created_at: '2018-08-19T13:55:04.485Z',
					__metadata: {
						uri: '/resin/user(@id)?@id=43699',
					},
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

	public expectGetMixpanel(opts: ScopeOpts = {}) {
		this.optGet(/^\/mixpanel\/track/, opts).reply(200, {});
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
