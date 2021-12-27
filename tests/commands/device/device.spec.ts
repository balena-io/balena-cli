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

import { isV14 } from '../../../lib/utils/version';

describe('balena device', function () {
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
		const { out, err } = await runCommand('device');
		const errLines = cleanOutput(err);

		expect(errLines[0]).to.equal('Missing 1 required argument:');
		expect(errLines[1]).to.equal('uuid : the device uuid');
		expect(out).to.eql([]);
	});

	it('should list device details for provided uuid', async () => {
		api.scope
			.get(
				/^\/v6\/device\?.+&\$expand=belongs_to__application\(\$select=app_name,slug\)/,
			)
			.replyWithFile(200, path.join(apiResponsePath, 'device.json'), {
				'Content-Type': 'application/json',
			});

		const { out } = await runCommand('device 27fda508c');

		const lines = cleanOutput(out);

		if (isV14()) {
			expect(lines).to.have.lengthOf(26);
			expect(lines[0]).to.equal('sparkling-wood');
			expect(lines[2].split(':')[0].trim()).to.equal('Id');
			expect(lines[2].split(':')[1].trim()).to.equal('1747415');
		} else {
			expect(lines).to.have.lengthOf(25);
			expect(lines[0]).to.equal('== SPARKLING WOOD');
			expect(lines[6].split(':')[1].trim()).to.equal('org/test app');
		}
	});

	it.skip('correctly handles devices with missing fields', async () => {
		api.scope
			.get(
				/^\/v6\/device\?.+&\$expand=belongs_to__application\(\$select=app_name,slug\)/,
			)
			.replyWithFile(
				200,
				path.join(apiResponsePath, 'device-missing-fields.json'),
				{
					'Content-Type': 'application/json',
				},
			);

		const { out } = await runCommand('device 27fda508c');

		const lines = cleanOutput(out);

		if (isV14()) {
			expect(lines).to.have.lengthOf(15);
			expect(lines[0]).to.equal('sparkling-wood');
			expect(lines[7].split(':')[1].trim()).to.equal('org/test app');
		} else {
			expect(lines).to.have.lengthOf(14);
			expect(lines[0]).to.equal('== SPARKLING WOOD');
			expect(lines[6].split(':')[1].trim()).to.equal('org/test app');
		}
	});

	it.skip('correctly handles devices with missing fleet', async () => {
		// Devices with missing fleets will have fleet name set to `N/a`.
		// e.g. When user has a device associated with fleet that user is no longer a collaborator of.
		api.scope
			.get(
				/^\/v6\/device\?.+&\$expand=belongs_to__application\(\$select=app_name,slug\)/,
			)
			.replyWithFile(
				200,
				path.join(apiResponsePath, 'device-missing-app.json'),
				{
					'Content-Type': 'application/json',
				},
			);

		const { out } = await runCommand('device 27fda508c');

		const lines = cleanOutput(out);

		if (isV14()) {
			expect(lines).to.have.lengthOf(26);
			expect(lines[0]).to.equal('sparkling-wood');
			expect(lines[9].split(':')[0].trim()).to.equal('Fleet');
			expect(lines[9].split(':')[1].trim()).to.equal('N/a');
		} else {
			expect(lines).to.have.lengthOf(25);
			expect(lines[0]).to.equal('== SPARKLING WOOD');
			expect(lines[6].split(':')[1].trim()).to.equal('N/a');
		}
	});
});
