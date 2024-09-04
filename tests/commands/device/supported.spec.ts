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

import { expect } from 'chai';

import { BalenaAPIMock } from '../../nock/balena-api-mock.js';
import { cleanOutput, runCommand } from '../../helpers.js';

describe('balena devices supported', function () {
	let api: BalenaAPIMock;

	beforeEach(() => {
		api = new BalenaAPIMock();
		api.expectGetWhoAmI({ optional: true });
		api.expectGetMixpanel({ optional: true });
	});

	afterEach(() => {
		// Check all expected api calls have been made and clean up.
		api.done();
	});

	it('should print help text with the -h flag', async () => {
		const { out, err } = await runCommand('devices supported -h');

		expect(cleanOutput(out)).to.contain('$ balena devices supported');

		expect(err).to.eql([]);
	});

	it('should list currently supported devices, with correct filtering', async () => {
		api.expectGetDeviceTypes();

		const { out, err } = await runCommand('devices supported');

		const lines = cleanOutput(out, true);

		expect(lines[0]).to.equal('SLUG ALIASES ARCH NAME');
		expect(lines).to.have.lengthOf.at.least(2);
		expect(lines).to.contain('intel-nuc nuc amd64 Intel NUC');
		expect(lines).to.contain(
			'odroid-xu4 odroid-u3+, odroid-ux3 armv7hf ODROID-XU4',
		);
		expect(err).to.eql([]);
	});
});
