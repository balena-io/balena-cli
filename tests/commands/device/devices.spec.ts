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
List all devices.

USAGE
  $ balena devices

OPTIONS
  -a, --application <application>  application name
  -h, --help                       show CLI help
  -j, --json                       produce JSON output instead of tabular output
  --app <app>                      same as '--application'

DESCRIPTION
  list all devices that belong to you.

  You can filter the devices by application by using the \`--application\` option.

  The --json option is recommended when scripting the output of this command,
  because field names are less likely to change in JSON format and because it
  better represents data types like arrays and empty strings. The 'jq' utility
  may also be helpful in shell scripts (https://stedolan.github.io/jq/manual/).

EXAMPLES
  $ balena devices
  $ balena devices --application MyApp
  $ balena devices --app MyApp
  $ balena devices -a MyApp
`;

describe('balena devices', function () {
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

	it('should print help text with the -h flag', async () => {
		const { out, err } = await runCommand('devices -h');

		expect(cleanOutput(out)).to.deep.equal(cleanOutput([HELP_RESPONSE]));

		expect(err).to.eql([]);
	});

	it('should list devices from own and collaborator apps', async () => {
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

		expect(lines.some((l) => l.includes('test app'))).to.be.true;

		// Devices with missing applications will have application name set to `N/a`.
		// e.g. When user has a device associated with app that user is no longer a collaborator of.
		expect(lines.some((l) => l.includes('N/a'))).to.be.true;

		expect(err).to.eql([]);
	});
});
