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
import { BalenaAPIMock } from '../../nock/balena-api-mock.js';
import { cleanOutput, runCommand } from '../../helpers.js';

describe('balena device move', function () {
	let api: BalenaAPIMock;

	beforeEach(() => {
		api = new BalenaAPIMock();
		api.expectGetWhoAmI({ optional: true, persist: true });
		api.expectGetMixpanel({ optional: true });
	});

	afterEach(() => {
		// Check all expected api calls have been made and clean up.
		api.done();
	});

	it('should error if uuid not provided', async () => {
		const { out, err } = await runCommand('device move');
		const errLines = cleanOutput(err);

		expect(errLines[0]).to.equal('Missing 1 required argument:');
		expect(errLines[1]).to.equal(
			'uuid : comma-separated list (no blank spaces) of device UUIDs to be moved',
		);
		expect(out).to.eql([]);
	});

	// TODO: Test to add once nock matching issues resolved:
	//  - 'should perform device move if application name provided'
	//  - 'should start interactive selection of application name if none provided'
	//  - 'correctly handles devices with missing application'
});
