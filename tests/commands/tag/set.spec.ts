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
import { runCommand } from '../../helpers';

describe('balena tag set', function () {
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

	it('should successfully set a tag', async () => {
		api.expectGetDevice({ fullUUID });
		api.scope.post(/^\/v\d+\/device_tag($|\?)/).reply(200, 'OK');

		const { out, err } = await runCommand(`tag set TEST 1 -d ${fullUUID}`);

		expect(out.join('')).to.equal('');
		expect(err.join('')).to.equal('');
	});

	it('should successfully set a tag w/o specifying a value', async () => {
		api.expectGetDevice({ fullUUID });
		api.scope.post(/^\/v\d+\/device_tag($|\?)/).reply(200, 'OK');

		const { out, err } = await runCommand(
			`tag set TEST_NO_VALUE -d ${fullUUID}`,
		);

		expect(out.join('')).to.equal('');
		expect(err.join('')).to.equal('');
	});

	it('should successfully set a tag w/ empty string as a value', async () => {
		api.expectGetDevice({ fullUUID });
		api.scope.post(/^\/v\d+\/device_tag($|\?)/).reply(200, 'OK');

		const { out, err } = await runCommand(
			`tag set TEST_EMPTY_STRING '' -d ${fullUUID}`,
		);

		expect(out.join('')).to.equal('');
		expect(err.join('')).to.equal('');
	});
});
