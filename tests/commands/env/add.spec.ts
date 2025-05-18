/**
 * @license
 * Copyright 2019-2020 Balena Ltd.
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

import { expect } from 'chai';

import { BalenaAPIMock } from '../../nock/balena-api-mock';
import { runCommand } from '../../helpers.js';

describe('balena env set', function () {
	let api: BalenaAPIMock;

	const fullUUID = 'f63fd7d7812c34c4c14ae023fdff05f5';

	beforeEach(() => {
		api = new BalenaAPIMock();
		api.expectGetWhoAmI({ optional: true, persist: true });
	});

	afterEach(() => {
		// Check all expected api calls have been made and clean up.
		api.done();
	});

	it('should successfully add an environment variable', async () => {
		api.expectGetDevice({ fullUUID });
		api.expectGetConfigVars();
		api.scope
			.post(/^\/v\d+\/device_environment_variable($|\?)/)
			.reply(200, 'OK');

		const { out, err } = await runCommand(`env set TEST 1 -d ${fullUUID}`);

		expect(out.join('')).to.equal('');
		expect(err.join('')).to.equal('');
	});

	it('should reject adding an environment variable w/o specifying a value when the process environment does not have an env var with the same name defined', async () => {
		// make sure that that there is no such env var defined atm
		delete process.env.TEST_ENV_VAR_ADD_NO_VALUE_REJECTED;

		const { out, err } = await runCommand(
			`env set TEST_ENV_VAR_ADD_NO_VALUE_REJECTED -d ${fullUUID}`,
		);

		expect(out.join('')).to.equal('');
		// Depending the context that the test was running , this was emiting either 1 or 2 '\n'
		expect(err.join('')).to.be.oneOf([
			'Value not found for environment variable: TEST_ENV_VAR_ADD_NO_VALUE_REJECTED\n',
			'Value not found for environment variable: TEST_ENV_VAR_ADD_NO_VALUE_REJECTED\n\n',
		]);
	});

	it('should successfully add an environment variable w/o specifying a value when the process environment has an env var with the same name defined', async () => {
		api.expectGetDevice({ fullUUID });
		api.expectGetConfigVars();
		api.scope
			.post(/^\/v\d+\/device_environment_variable($|\?)/)
			.reply(200, 'OK');

		process.env.TEST_ENV_VAR_ADD_NO_VALUE = '4';

		const { out, err } = await runCommand(
			`env set TEST_ENV_VAR_ADD_NO_VALUE -d ${fullUUID}`,
		);

		delete process.env.TEST_ENV_VAR_ADD_NO_VALUE;

		expect(out.join('')).to.equal('');
		expect(err.join('')).to.be.oneOf([
			' ›   Warning: Using TEST_ENV_VAR_ADD_NO_VALUE=4 from CLI process environment\n',
			// emitted when running on the windows instance
			' »   Warning: Using TEST_ENV_VAR_ADD_NO_VALUE=4 from CLI process environment\n',
		]);
	});

	it('should successfully add an environment variable w/ empty string as a value', async () => {
		api.expectGetDevice({ fullUUID });
		api.expectGetConfigVars();
		api.scope
			.post(/^\/v\d+\/device_environment_variable($|\?)/)
			.reply(200, 'OK');

		const { out, err } = await runCommand(
			`env set TEST_EMPTY_STRING '' -d ${fullUUID}`,
		);

		expect(out.join('')).to.equal('');
		expect(err.join('')).to.equal('');
	});
});
