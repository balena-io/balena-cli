/**
 * @license
 * Copyright 2019 Balena Ltd.
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

import * as _ from 'lodash';
import * as nock from 'nock';

export class BalenaAPIMock {
	public static basePathPattern = /api\.balena-cloud\.com/;
	public readonly scope: nock.Scope;
	// Expose `scope` as `expect` to allow for better semantics in tests
	public readonly expect = this.scope;

	// For debugging tests
	get unfulfilledCallCount(): number {
		return this.scope.pendingMocks().length;
	}

	constructor() {
		nock.cleanAll();

		if (!nock.isActive()) {
			nock.activate();
		}

		this.scope = nock(BalenaAPIMock.basePathPattern);

		nock.emitter.on('no match', this.handleUnexpectedRequest);
	}

	public done() {
		// scope.done() will throw an error if there are expected api calls that have not happened.
		// So ensures that all expected calls have been made.
		this.scope.done();
		// Remove 'no match' handler, for tests using nock without this module
		nock.emitter.removeListener('no match', this.handleUnexpectedRequest);
		// Restore unmocked behaviour
		nock.cleanAll();
		nock.restore();
	}

	public expectTestApp() {
		this.scope
			.get(/^\/v\d+\/application($|\?)/)
			.reply(200, { d: [{ id: 1234567 }] });
	}

	public expectTestDevice(
		fullUUID = 'f63fd7d7812c34c4c14ae023fdff05f5',
		inaccessibleApp = false,
	) {
		const id = 7654321;
		this.scope.get(/^\/v\d+\/device($|\?)/).reply(200, {
			d: [
				{
					id,
					uuid: fullUUID,
					belongs_to__application: inaccessibleApp
						? []
						: [{ app_name: 'test' }],
				},
			],
		});
	}

	public expectAppEnvVars() {
		this.scope
			.get(/^\/v\d+\/application_environment_variable($|\?)/)
			.reply(200, {
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
			});
	}

	public expectAppConfigVars() {
		this.scope.get(/^\/v\d+\/application_config_variable($|\?)/).reply(200, {
			d: [
				{
					id: 120300,
					name: 'RESIN_SUPERVISOR_NATIVE_LOGGER',
					value: 'false',
				},
			],
		});
	}

	public expectAppServiceVars() {
		this.scope
			.get(/^\/v\d+\/service_environment_variable($|\?)/)
			.reply(function(uri, _requestBody) {
				const match = uri.match(/service_name%20eq%20%27(.+?)%27/);
				const serviceName = (match && match[1]) || undefined;
				let varArray: any[];
				if (serviceName) {
					const varObj = appServiceVarsByService[serviceName];
					varArray = varObj ? [varObj] : [];
				} else {
					varArray = _.map(appServiceVarsByService, value => value);
				}
				return [200, { d: varArray }];
			});
	}

	public expectDeviceEnvVars() {
		this.scope.get(/^\/v\d+\/device_environment_variable($|\?)/).reply(200, {
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

	public expectDeviceConfigVars() {
		this.scope.get(/^\/v\d+\/device_config_variable($|\?)/).reply(200, {
			d: [
				{
					id: 120400,
					name: 'RESIN_SUPERVISOR_POLL_INTERVAL',
					value: '900900',
				},
			],
		});
	}

	public expectDeviceServiceVars() {
		this.scope
			.get(/^\/v\d+\/device_service_environment_variable($|\?)/)
			.reply(function(uri, _requestBody) {
				const match = uri.match(/service_name%20eq%20%27(.+?)%27/);
				const serviceName = (match && match[1]) || undefined;
				let varArray: any[];
				if (serviceName) {
					const varObj = deviceServiceVarsByService[serviceName];
					varArray = varObj ? [varObj] : [];
				} else {
					varArray = _.map(deviceServiceVarsByService, value => value);
				}
				return [200, { d: varArray }];
			});
	}

	public expectConfigVars() {
		this.scope.get('/config/vars').reply(200, {
			reservedNames: [],
			reservedNamespaces: [],
			invalidRegex: '/^d|W/',
			whiteListedNames: [],
			whiteListedNamespaces: [],
			blackListedNames: [],
			configVarSchema: [],
		});
	}

	public expectService(serviceName: string, serviceId = 243768) {
		this.scope.get(/^\/v\d+\/service($|\?)/).reply(200, {
			d: [{ id: serviceId, service_name: serviceName }],
		});
	}

	// User details are cached in the SDK
	// so often we don't know if we can expect the whoami request
	public expectWhoAmI(persist = false, optional = true) {
		const get = (persist ? this.scope.persist() : this.scope).get(
			'/user/v1/whoami',
		);
		(optional ? get.optionally() : get).reply(200, {
			id: 99999,
			username: 'testuser',
			email: 'testuser@test.com',
		});
	}

	public expectMixpanel(optional = true) {
		const get = this.scope.get(/^\/mixpanel\/track/);
		(optional ? get.optionally() : get).reply(200, {});
	}

	protected handleUnexpectedRequest(req: any) {
		console.error(`Unexpected http request!: ${req.path}`);
		// Errors thrown here are not causing the tests to fail for some reason.
		// Possibly due to CLI global error handlers? (error.js)
		// (Also, nock should automatically throw an error, but also not happening)
		// For now, the console.error is sufficient (will fail the test)
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
