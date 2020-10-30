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
import { BalenaAPIMock } from '../../balena-api-mock';
import { cleanOutput, runCommand } from '../../helpers';

const HELP_RESPONSE = `
Move one or more devices to another application.

USAGE
  $ balena device move <uuid(s)>

ARGUMENTS
  [uuid]  comma-separated list (no blank spaces) of device UUIDs to be moved

OPTIONS
  -h, --help                             show CLI help
  --app <app>                            alias for --application
  --app-id <app-id>                      alias for --application-id
  --app-name <app-name>                  alias for --application-name
  --app-uuid <app-uuid>                  alias for --application-uuid
  --application <application>            application name, UUID or numeric database ID
  --application-id <application-id>      application numeric database ID
  --application-name <application-name>  application name
  --application-uuid <application-uuid>  application UUID
  --id <id>                              comma-separated list of numeric device database IDs
  --uuid <uuid>                          comma-separated list of device UUIDs

DESCRIPTION
  Move one or more devices to another application.

  Note, if the application option is omitted it will be prompted
  for interactively.

EXAMPLES
  $ balena device move 7cf02a6
  $ balena device move 7cf02a6,dc39e52
  $ balena device move 7cf02a6 --application MyNewApp
`;

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

	it('should print help text with the -h flag', async () => {
		const { out, err } = await runCommand('device move -h');

		expect(cleanOutput(out)).to.deep.equal(cleanOutput([HELP_RESPONSE]));

		expect(err).to.eql([]);
	});

	it('should error if uuid not provided', async () => {
		const { out, err } = await runCommand('device move');
		const errLines = cleanOutput(err);

		expect(errLines[0]).to.equal(
			'At least one "uuid" positional argument or "--uuid" or "--id" options must be provided',
		);
		expect(out).to.eql([]);
	});

	// TODO: Test to add once nock matching issues resolved:
	//  - 'should perform device move if application name provided'
	//  - 'should start interactive selection of application name if none provided'
	//  - 'correctly handles devices with missing application'
});
