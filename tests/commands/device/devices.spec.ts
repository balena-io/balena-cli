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
Usage: devices

Use this command to list all devices that belong to you.

You can filter the devices by application by using the \`--application\` option.

Examples:

\t$ balena devices
\t$ balena devices --application MyApp
\t$ balena devices --app MyApp
\t$ balena devices -a MyApp

Options:

    --application, -a, --app <application> application name
`;

describe('balena devices', function() {
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

		const { out, err } = await runCommand('devices -h');

		expect(cleanOutput(out)).to.deep.equal(cleanOutput([HELP_RESPONSE]));

		expect(err).to.eql([]);
	});

	it('should list devices from own and collaborator apps', async () => {
		api.expectGetWhoAmI({ optional: true, persist: true });
		api.expectGetMixpanel({ optional: true });

		api.scope
			.get(
				'/v5/device?$orderby=device_name%20asc&$expand=belongs_to__application($select=app_name)',
			)
			.replyWithFile(200, path.join(apiResponsePath, 'devices.json'), {
				'Content-Type': 'application/json',
			});

		const { out, err } = await runCommand('devices');

		const lines = cleanOutput(out);

		expect(lines[0].replace(/  +/g, ' ')).to.equal(
			'ID UUID DEVICE NAME DEVICE TYPE APPLICATION NAME STATUS ' +
				'IS ONLINE SUPERVISOR VERSION OS VERSION DASHBOARD URL',
		);
		expect(lines).to.have.lengthOf.at.least(2);

		expect(lines.some(l => l.includes('test app'))).to.be.true;

		// Devices with missing applications will have application name set to `N/a`.
		// e.g. When user has a device associated with app that user is no longer a collaborator of.
		expect(lines.some(l => l.includes('N/a'))).to.be.true;

		expect(err).to.eql([]);
	});
});
