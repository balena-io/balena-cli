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

import * as nock from 'nock';

class BalenaAPIMock {
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

	public expectTestDevice() {
		this.scope.get(/\/v\d+\/device($|\?)/).reply(200, { d: [{ id: 7654321 }] });
	}

	public expectDeviceEnvVars() {
		this.scope.post(/\/v\d+\/device_environment_variable($|\?)/).reply(201, {
			id: 120203,
			name: 'var3',
			value: 'var3-val',
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

	// User details are cached in the SDK
	// so often we don't know if we can expect the whoami request
	public expectOptionalWhoAmI(persist = false) {
		(persist ? this.scope.persist() : this.scope)
			.get('/user/v1/whoami')
			.optionally()
			.reply(200, {
				id: 99999,
				username: 'testuser',
				email: 'testuser@test.com',
			});
	}

	public expectMixpanel(optional = false) {
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

export { BalenaAPIMock };
