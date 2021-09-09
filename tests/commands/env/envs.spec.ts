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
import { stripIndent } from '../../../build/utils/lazy';

import { BalenaAPIMock } from '../../nock/balena-api-mock';
import { runCommand } from '../../helpers';

import { appToFleetOutputMsg, warnify } from '../../../build/utils/messages';
import { isV13 } from '../../../build/utils/version';

describe('balena envs', function () {
	const appName = 'test';
	let fullUUID: string;
	let shortUUID: string;
	let api: BalenaAPIMock;

	beforeEach(() => {
		api = new BalenaAPIMock();
		api.expectGetWhoAmI({ optional: true, persist: true });
		api.expectGetMixpanel({ optional: true });
		// Random device UUID used to frustrate _.memoize() in utils/cloud.ts
		fullUUID = require('crypto').randomBytes(16).toString('hex');
		shortUUID = fullUUID.substring(0, 7);
	});

	afterEach(() => {
		// Check all expected api calls have been made and clean up.
		api.done();
	});

	const appToFleetOutputWarn =
		!isV13() &&
		process.stderr.isTTY &&
		process.env.BALENA_CLI_TEST_TYPE !== 'standalone'
			? warnify(appToFleetOutputMsg) + '\n'
			: '';

	it('should successfully list env vars for a test fleet', async () => {
		api.expectGetApplication();
		api.expectGetAppEnvVars();
		api.expectGetAppServiceVars();

		const { out, err } = await runCommand(`envs -f ${appName}`);

		expect(out.join('')).to.equal(
			stripIndent`
			ID     NAME  VALUE       FLEET SERVICE
			120110 svar1 svar1-value test  service1
			120111 svar2 svar2-value test  service2
			120101 var1  var1-val    test  *
			120102 var2  22          test  *
		` + '\n',
		);
		expect(err.join('')).to.equal('');
	});

	it('should successfully list config vars for a test fleet', async () => {
		api.expectGetApplication();
		api.expectGetAppConfigVars();

		const { out, err } = await runCommand(`envs -f ${appName} --config`);

		expect(out.join('')).to.equal(
			stripIndent`
			ID     NAME                           VALUE FLEET
			120300 RESIN_SUPERVISOR_NATIVE_LOGGER false test
		` + '\n',
		);

		expect(err.join('')).to.equal('');
	});

	it('should successfully list config vars for a test fleet (JSON output)', async () => {
		api.expectGetApplication();
		api.expectGetAppConfigVars();

		const { out, err } = await runCommand(`envs -cjf ${appName}`);

		expect(JSON.parse(out.join(''))).to.deep.equal([
			{
				fleetName: 'test',
				id: 120300,
				name: 'RESIN_SUPERVISOR_NATIVE_LOGGER',
				value: 'false',
			},
		]);
		expect(err.join('')).to.equal('');
	});

	it('should successfully list service variables for a test fleet (-s flag)', async () => {
		const serviceName = 'service2';
		api.expectGetService({ serviceName });
		api.expectGetApplication();
		api.expectGetAppEnvVars();
		api.expectGetAppServiceVars();

		const { out, err } = await runCommand(
			`envs -f ${appName} -s ${serviceName}`,
		);

		expect(out.join('')).to.equal(
			stripIndent`
		ID     NAME  VALUE       FLEET SERVICE
		120111 svar2 svar2-value test  service2
		120101 var1  var1-val    test  *
		120102 var2  22          test  *
		` + '\n',
		);
		expect(err.join('')).to.equal('');
	});

	it('should successfully list env and service vars for a test fleet (-s flags)', async () => {
		const serviceName = 'service1';
		api.expectGetService({ serviceName });
		api.expectGetApplication();
		api.expectGetAppEnvVars();
		api.expectGetAppServiceVars();

		const { out, err } = await runCommand(
			`envs -f ${appName} -s ${serviceName}`,
		);

		expect(out.join('')).to.equal(
			stripIndent`
		ID     NAME  VALUE       FLEET SERVICE
		120110 svar1 svar1-value test  ${serviceName}
		120101 var1  var1-val    test  *
		120102 var2  22          test  *
		` + '\n',
		);
		expect(err.join('')).to.equal('');
	});

	it('should successfully list env variables for a test device', async () => {
		api.expectGetDevice({ fullUUID });
		api.expectGetDeviceEnvVars();
		api.expectGetApplication();
		api.expectGetAppEnvVars();
		api.expectGetAppServiceVars();
		api.expectGetDeviceServiceVars();

		const uuid = shortUUID;
		const result = await runCommand(`envs -d ${uuid}`);
		const { err } = result;
		let { out } = result;
		let expected =
			stripIndent`
			ID     NAME  VALUE       APPLICATION DEVICE  SERVICE
			120110 svar1 svar1-value test        *       service1
			120111 svar2 svar2-value test        *       service2
			120120 svar3 svar3-value test        ${uuid} service1
			120121 svar4 svar4-value test        ${uuid} service2
			120101 var1  var1-val    test        *       *
			120102 var2  22          test        *       *
			120203 var3  var3-val    test        ${uuid} *
			120204 var4  44          test        ${uuid} *
			` + '\n';
		if (isV13()) {
			out = out.map((l) => l.replace(/ +/g, ' '));
			expected = expected
				.replace(/ +/g, ' ')
				.replace(' APPLICATION ', ' FLEET ')
				.replace(/ test /g, ' org/test ');
		}
		expect(out.join('')).to.equal(expected);
		expect(err.join('')).to.equal(appToFleetOutputWarn);
	});

	it('should successfully list env variables for a test device (JSON output)', async () => {
		api.expectGetDevice({ fullUUID });
		api.expectGetDeviceEnvVars();
		api.expectGetApplication();
		api.expectGetAppEnvVars();
		api.expectGetAppServiceVars();
		api.expectGetDeviceServiceVars();

		const { out, err } = await runCommand(`envs -jd ${shortUUID}`);
		let expected = `[
			{ "id": 120101, "appName": "test", "deviceUUID": "*", "name": "var1", "value": "var1-val", "serviceName": "*" },
			{ "id": 120102, "appName": "test", "deviceUUID": "*", "name": "var2", "value": "22", "serviceName": "*" },
			{ "id": 120110, "appName": "test", "deviceUUID": "*", "name": "svar1", "value": "svar1-value", "serviceName": "service1" },
			{ "id": 120111, "appName": "test", "deviceUUID": "*", "name": "svar2", "value": "svar2-value", "serviceName": "service2" },
			{ "id": 120120, "appName": "test", "deviceUUID": "${fullUUID}", "name": "svar3", "value": "svar3-value", "serviceName": "service1" },
			{ "id": 120121, "appName": "test", "deviceUUID": "${fullUUID}", "name": "svar4", "value": "svar4-value", "serviceName": "service2" },
			{ "id": 120203, "appName": "test", "deviceUUID": "${fullUUID}", "name": "var3", "value": "var3-val", "serviceName": "*" },
			{ "id": 120204, "appName": "test", "deviceUUID": "${fullUUID}", "name": "var4", "value": "44", "serviceName": "*" }
		]`;
		if (isV13()) {
			expected = expected.replace(
				/"appName": "test"/g,
				'"fleetName": "org/test"',
			);
		}
		expect(JSON.parse(out.join(''))).to.deep.equal(JSON.parse(expected));
		expect(err.join('')).to.equal('');
	});

	it('should successfully list config variables for a test device', async () => {
		api.expectGetDevice({ fullUUID });
		api.expectGetDeviceConfigVars();
		api.expectGetApplication();
		api.expectGetAppConfigVars();

		const result = await runCommand(`envs -d ${shortUUID} --config`);
		const { err } = result;
		let { out } = result;
		let expected =
			stripIndent`
			ID     NAME                           VALUE  APPLICATION DEVICE
			120300 RESIN_SUPERVISOR_NATIVE_LOGGER false  test        *
			120400 RESIN_SUPERVISOR_POLL_INTERVAL 900900 test        ${shortUUID}
		` + '\n';
		if (isV13()) {
			out = out.map((l) => l.replace(/ +/g, ' '));
			expected = expected
				.replace(/ +/g, ' ')
				.replace(' APPLICATION ', ' FLEET ')
				.replace(/ test /g, ' org/test ');
		}
		expect(out.join('')).to.equal(expected);
		expect(err.join('')).to.equal(appToFleetOutputWarn);
	});

	it('should successfully list service variables for a test device (-s flag)', async () => {
		const serviceName = 'service2';
		api.expectGetService({ serviceName });
		api.expectGetApplication();
		api.expectGetDevice({ fullUUID });
		api.expectGetDeviceServiceVars();
		api.expectGetAppEnvVars();
		api.expectGetAppServiceVars();
		api.expectGetDeviceEnvVars();

		const uuid = shortUUID;
		const result = await runCommand(`envs -d ${uuid} -s ${serviceName}`);
		const { err } = result;
		let { out } = result;
		let expected =
			stripIndent`
			ID     NAME  VALUE       APPLICATION DEVICE  SERVICE
			120111 svar2 svar2-value test        *       service2
			120121 svar4 svar4-value test        ${uuid} service2
			120101 var1  var1-val    test        *       *
			120102 var2  22          test        *       *
			120203 var3  var3-val    test        ${uuid} *
			120204 var4  44          test        ${uuid} *
		` + '\n';
		if (isV13()) {
			out = out.map((l) => l.replace(/ +/g, ' '));
			expected = expected
				.replace(/ +/g, ' ')
				.replace(' APPLICATION ', ' FLEET ')
				.replace(/ test /g, ' org/test ');
		}
		expect(out.join('')).to.equal(expected);
		expect(err.join('')).to.equal(appToFleetOutputWarn);
	});

	it('should successfully list env and service variables for a test device (unknown fleet)', async () => {
		api.expectGetDevice({ fullUUID, inaccessibleApp: true });
		api.expectGetDeviceEnvVars();
		api.expectGetDeviceServiceVars();

		const uuid = shortUUID;
		const result = await runCommand(`envs -d ${uuid}`);
		const { err } = result;
		let { out } = result;
		let expected =
			stripIndent`
			ID     NAME  VALUE       APPLICATION DEVICE  SERVICE
			120120 svar3 svar3-value N/A         ${uuid} service1
			120121 svar4 svar4-value N/A         ${uuid} service2
			120203 var3  var3-val    N/A         ${uuid} *
			120204 var4  44          N/A         ${uuid} *
		` + '\n';
		if (isV13()) {
			out = out.map((l) => l.replace(/ +/g, ' '));
			expected = expected
				.replace(/ +/g, ' ')
				.replace(' APPLICATION ', ' FLEET ');
		}
		expect(out.join('')).to.equal(expected);
		expect(err.join('')).to.equal(appToFleetOutputWarn);
	});

	it('should successfully list env and service vars for a test device (-s flags)', async () => {
		const serviceName = 'service1';
		api.expectGetService({ serviceName });
		api.expectGetApplication();
		api.expectGetAppEnvVars();
		api.expectGetAppServiceVars();
		api.expectGetDevice({ fullUUID });
		api.expectGetDeviceEnvVars();
		api.expectGetDeviceServiceVars();

		const uuid = shortUUID;
		const result = await runCommand(`envs -d ${uuid} -s ${serviceName}`);
		const { err } = result;
		let { out } = result;
		let expected =
			stripIndent`
			ID     NAME  VALUE       APPLICATION DEVICE  SERVICE
			120110 svar1 svar1-value test        *       ${serviceName}
			120120 svar3 svar3-value test        ${uuid} ${serviceName}
			120101 var1  var1-val    test        *       *
			120102 var2  22          test        *       *
			120203 var3  var3-val    test        ${uuid} *
			120204 var4  44          test        ${uuid} *
		` + '\n';
		if (isV13()) {
			out = out.map((l) => l.replace(/ +/g, ' '));
			expected = expected
				.replace(/ +/g, ' ')
				.replace(' APPLICATION ', ' FLEET ')
				.replace(/ test /g, ' org/test ');
		}
		expect(out.join('')).to.equal(expected);
		expect(err.join('')).to.equal(appToFleetOutputWarn);
	});

	it('should successfully list env and service vars for a test device (-js flags)', async () => {
		const serviceName = 'service1';
		api.expectGetService({ serviceName });
		api.expectGetApplication();
		api.expectGetAppEnvVars();
		api.expectGetAppServiceVars();
		api.expectGetDevice({ fullUUID });
		api.expectGetDeviceEnvVars();
		api.expectGetDeviceServiceVars();

		const { out, err } = await runCommand(
			`envs -d ${shortUUID} -js ${serviceName}`,
		);
		let expected = `[
			{ "id": 120101, "appName": "test", "deviceUUID": "*", "name": "var1", "value": "var1-val", "serviceName": "*" },
			{ "id": 120102, "appName": "test", "deviceUUID": "*", "name": "var2", "value": "22", "serviceName": "*" },
			{ "id": 120110, "appName": "test", "deviceUUID": "*", "name": "svar1", "value": "svar1-value", "serviceName": "${serviceName}" },
			{ "id": 120120, "appName": "test", "deviceUUID": "${fullUUID}", "name": "svar3", "value": "svar3-value", "serviceName": "${serviceName}" },
			{ "id": 120203, "appName": "test", "deviceUUID": "${fullUUID}", "name": "var3", "value": "var3-val", "serviceName": "*" },
			{ "id": 120204, "appName": "test", "deviceUUID": "${fullUUID}", "name": "var4", "value": "44", "serviceName": "*" }
		]`;
		if (isV13()) {
			expected = expected.replace(
				/"appName": "test"/g,
				'"fleetName": "org/test"',
			);
		}
		expect(JSON.parse(out.join(''))).to.deep.equal(JSON.parse(expected));
		expect(err.join('')).to.equal('');
	});
});
