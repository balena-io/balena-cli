/**
 * @license
 * Copyright 2019 Balena Ltd.
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
import { stripIndent } from 'common-tags';

import { BalenaAPIMock } from '../../balena-api-mock';
import { runCommand } from '../../helpers';

describe('balena envs', function() {
	const appName = 'test';
	const deviceUUID = 'f63fd7d7812c34c4c14ae023fdff05f5';
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

	it('should successfully list env vars for a test app', async () => {
		api.expectTestApp();
		api.expectAppEnvVars();

		const { out, err } = await runCommand(`envs -a ${appName}`);

		expect(out.join('')).to.equal(
			stripIndent`
			ID     NAME VALUE
			120101 var1 var1-val
			120102 var2 22
		` + '\n',
		);
		expect(err.join('')).to.equal('');
	});

	it('should successfully list env vars for a test device', async () => {
		api.expectTestDevice();
		api.expectDeviceEnvVars();

		const { out, err } = await runCommand(`envs -d ${deviceUUID}`);

		expect(out.join('')).to.equal(
			stripIndent`
			ID     NAME VALUE
			120203 var3 var3-val
			120204 var4 44
		` + '\n',
		);
		expect(err.join('')).to.equal('');
	});

	it('should successfully list env vars for a test device (JSON output)', async () => {
		api.expectTestDevice();
		api.expectDeviceEnvVars();

		const { out, err } = await runCommand(`envs -jd ${deviceUUID}`);

		expect(JSON.parse(out.join(''))).to.deep.equal([
			{
				id: 120203,
				name: 'var3',
				value: 'var3-val',
			},
			{
				id: 120204,
				name: 'var4',
				value: '44',
			},
		]);
		expect(err.join('')).to.equal('');
	});

	it('should successfully list config vars for a test app', async () => {
		api.expectTestApp();
		api.expectAppConfigVars();

		const { out, err } = await runCommand(`envs -a ${appName} --config`);

		expect(out.join('')).to.equal(
			stripIndent`
			ID     NAME                           VALUE
			120300 RESIN_SUPERVISOR_NATIVE_LOGGER false
		` + '\n',
		);
		expect(err.join('')).to.equal('');
	});

	it('should successfully list config vars for a test app (JSON output)', async () => {
		api.expectTestApp();
		api.expectAppConfigVars();

		const { out, err } = await runCommand(`envs -cja ${appName}`);

		expect(JSON.parse(out.join(''))).to.deep.equal([
			{
				id: 120300,
				name: 'RESIN_SUPERVISOR_NATIVE_LOGGER',
				value: 'false',
			},
		]);
		expect(err.join('')).to.equal('');
	});

	it('should successfully list config vars for a test device', async () => {
		api.expectTestDevice();
		api.expectDeviceConfigVars();

		const { out, err } = await runCommand(`envs -d ${deviceUUID} --config`);

		expect(out.join('')).to.equal(
			stripIndent`
			ID     NAME                           VALUE
			120400 RESIN_SUPERVISOR_POLL_INTERVAL 900900
		` + '\n',
		);
		expect(err.join('')).to.equal('');
	});
});
