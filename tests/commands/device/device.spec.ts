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
import * as path from 'path';

import { apiResponsePath, BalenaAPIMock } from '../../balena-api-mock';
import { cleanOutput, runCommand } from '../../helpers';

const HELP_RESPONSE = `
Usage: device <uuid>

Use this command to show information about a single device.

Examples:

\t$ balena device 7cf02a6
`;

describe('balena device', function() {
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

		const { out, err } = await runCommand('device -h');

		expect(cleanOutput(out)).to.deep.equal(cleanOutput([HELP_RESPONSE]));

		expect(err).to.eql([]);
	});

	it.skip('should error if uuid not provided', async () => {
		// TODO: Figure out how to test for expected errors with current setup
		//  including exit codes if possible.
		api.expectGetWhoAmI({ optional: true });
		api.expectGetMixpanel({ optional: true });

		const { out, err } = await runCommand('device');
		const errLines = cleanOutput(err);

		expect(errLines[0]).to.equal('Missing uuid');
		expect(out).to.eql([]);
	});

	it('should list device details for provided uuid', async () => {
		api.expectGetWhoAmI({ optional: true, persist: true });
		api.expectGetMixpanel({ optional: true });
		api.expectGetDeviceStatus();
		api.scope
			.get(
				/^\/v5\/device\?.+&\$expand=belongs_to__application\(\$select=app_name\)/,
			)
			.replyWithFile(200, path.join(apiResponsePath, 'device.json'), {
				'Content-Type': 'application/json',
			});

		const { out, err } = await runCommand('device 27fda508c');

		const lines = cleanOutput(out);

		expect(lines).to.have.lengthOf(13);
		expect(lines[0]).to.equal('== SPARKLING WOOD');
		expect(lines[6].split(':')[1].trim()).to.equal('test app');

		expect(err).to.eql([]);
	});

	it('correctly handles devices with missing application', async () => {
		// Devices with missing applications will have application name set to `N/a`.
		// e.g. When user has a device associated with app that user is no longer a collaborator of.
		api.expectGetWhoAmI({ optional: true, persist: true });
		api.expectGetMixpanel({ optional: true });
		api.expectGetDeviceStatus();
		api.scope
			.get(
				/^\/v5\/device\?.+&\$expand=belongs_to__application\(\$select=app_name\)/,
			)
			.replyWithFile(
				200,
				path.join(apiResponsePath, 'device-missing-app.json'),
				{
					'Content-Type': 'application/json',
				},
			);

		const { out, err } = await runCommand('device 27fda508c');

		const lines = cleanOutput(out);

		expect(lines).to.have.lengthOf(13);
		expect(lines[0]).to.equal('== SPARKLING WOOD');
		expect(lines[6].split(':')[1].trim()).to.equal('N/a');

		expect(err).to.eql([]);
	});
});
