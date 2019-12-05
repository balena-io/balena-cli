/**
 * @license
 * Copyright 2016-2019 Balena Ltd.
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

import { BalenaAPIMock } from '../../balena-api-mock';
import { runCommand } from '../../helpers';

describe('balena env rm', function() {
	let api: BalenaAPIMock;

	beforeEach(() => {
		api = new BalenaAPIMock();
		api.expectOptionalWhoAmI(true);
		api.expectMixpanel(true);
	});

	afterEach(() => {
		// Check all expected api calls have been made and clean up.
		api.done();
	});

	it('should successfully delete an environment variable', async () => {
		api.scope.delete(/device_environment_variable/).reply(200, 'OK');

		const { out, err } = await runCommand('env rm 144690 -d -y');

		expect(out.join('')).to.equal('');
		expect(err.join('')).to.equal('');
	});
});
