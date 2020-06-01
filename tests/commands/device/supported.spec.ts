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

import { isV12 } from '../../../build/utils/version';
import { BalenaAPIMock } from '../../balena-api-mock';
import { cleanOutput, runCommand } from '../../helpers';

describe('balena devices supported', function() {
	let api: BalenaAPIMock;

	beforeEach(() => {
		api = new BalenaAPIMock();
	});

	afterEach(() => {
		// Check all expected api calls have been made and clean up.
		api.done();
	});

	it('should print help text with the -h flag', async () => {
		api.expectGetWhoAmI({ optional: true });
		api.expectGetMixpanel({ optional: true });

		const { out, err } = await runCommand('devices supported -h');

		expect(cleanOutput(out)).to.contain('$ balena devices supported');

		expect(err).to.eql([]);
	});

	it('should list currently supported devices, with correct filtering', async () => {
		api.expectGetWhoAmI({ optional: true });
		api.expectGetMixpanel({ optional: true });
		api.expectGetDeviceTypes();

		const { out, err } = await runCommand('devices supported');

		const lines = cleanOutput(out);

		expect(lines[0].replace(/  +/g, ' ')).to.equal(
			isV12() ? 'SLUG ALIASES ARCH NAME' : 'SLUG NAME',
		);
		expect(lines).to.have.lengthOf.at.least(2);

		// Discontinued devices should be filtered out from results
		expect(lines.some(l => l.includes('DISCONTINUED'))).to.be.false;

		// Experimental devices should be listed as beta
		expect(lines.some(l => l.includes('EXPERIMENTAL'))).to.be.false;
		expect(lines.some(l => l.includes('NEW'))).to.be.true;

		expect(err).to.eql([]);
	});
});
