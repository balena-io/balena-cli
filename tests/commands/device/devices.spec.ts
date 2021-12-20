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

import { apiResponsePath, BalenaAPIMock } from '../../nock/balena-api-mock';
import { cleanOutput, runCommand } from '../../helpers';

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

	it('should list devices from own and collaborator apps', async () => {
		api.scope
			.get(
				'/v6/device?$orderby=device_name%20asc&$expand=belongs_to__application($select=app_name,slug),is_of__device_type($select=slug),is_running__release($select=commit)',
			)
			.replyWithFile(200, path.join(apiResponsePath, 'devices.json'), {
				'Content-Type': 'application/json',
			});

		const { out } = await runCommand('devices');

		const lines = cleanOutput(out);

		expect(lines[0].replace(/  +/g, ' ')).to.equal(
			'ID UUID DEVICE NAME DEVICE TYPE FLEET STATUS IS ONLINE SUPERVISOR VERSION OS VERSION DASHBOARD URL',
		);
		expect(lines).to.have.lengthOf.at.least(2);

		expect(lines.some((l) => l.includes('org/test app'))).to.be.true;

		// Devices with missing applications will have application name set to `N/a`.
		// e.g. When user has a device associated with app that user is no longer a collaborator of.
		expect(lines.some((l) => l.includes('N/a'))).to.be.true;
	});
});
