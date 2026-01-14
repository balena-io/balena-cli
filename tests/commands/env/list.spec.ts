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

import { runCommand } from '../../helpers.js';
import { randomBytes } from 'node:crypto';
import { MockHttpServer } from '../../mockserver.js';

describe('balena env list', function () {
	const appName = 'test';
	let fullUUID: string;
	let shortUUID: string;
	let api: MockHttpServer['api'];
	let server: MockHttpServer;

	before(async () => {
		server = new MockHttpServer();
		api = server.api;
		await server.start();
		await api.expectGetWhoAmI({ optional: true, persist: true });
	});

	after(async () => {
		await server.stop();
	});

	beforeEach(() => {
		// Random device UUID used to frustrate _.memoize() in utils/cloud.ts
		fullUUID = randomBytes(16).toString('hex');
		shortUUID = fullUUID.substring(0, 7);
	});

	afterEach(async () => {
		await server.assertAllCalled();
	});

	it('should successfully list env vars for a test fleet', async () => {
		await api.expectGetApplication();
		await api.expectGetAppEnvVars();
		await api.expectGetAppServiceVars();

		const { out, err } = await runCommand(`env list -f ${appName}`);

		expect(out.join('')).to.equal(
			stripIndent`
			ID     NAME  VALUE       FLEET           SERVICE
			120110 svar1 svar1-value gh_user/testApp service1
			120111 svar2 svar2-value gh_user/testApp service2
			120101 var1  var1-val    gh_user/testApp *
			120102 var2  22          gh_user/testApp *
		` + '\n',
		);
		expect(err.join('')).to.equal('');
	});

	it('should successfully list config vars for a test fleet', async () => {
		await api.expectGetApplication();
		await api.expectGetAppConfigVars();

		const { out, err } = await runCommand(`env list -f ${appName} --config`);

		expect(out.join('')).to.equal(
			stripIndent`
			ID     NAME                           VALUE FLEET
			120300 RESIN_SUPERVISOR_NATIVE_LOGGER false gh_user/testApp
		` + '\n',
		);

		expect(err.join('')).to.equal('');
	});

	it('should successfully list config vars for a test fleet (JSON output)', async () => {
		await api.expectGetApplication();
		await api.expectGetAppConfigVars();

		const { out, err } = await runCommand(`env list -cf ${appName} --json`);

		expect(JSON.parse(out.join(''))).to.deep.equal([
			{
				fleet: 'gh_user/testApp',
				id: 120300,
				name: 'RESIN_SUPERVISOR_NATIVE_LOGGER',
				value: 'false',
			},
		]);
		expect(err.join('')).to.equal('');
	});

	it('should successfully list service variables for a test fleet (-s flag)', async () => {
		const serviceName = 'service2';
		await api.expectGetServiceFromApp({ serviceName });
		await api.expectGetApplication();
		await api.expectGetAppEnvVars();
		await api.expectGetAppServiceVars();

		const { out, err } = await runCommand(
			`env list -f ${appName} -s ${serviceName}`,
		);

		expect(out.join('')).to.equal(
			stripIndent`
		ID     NAME  VALUE       FLEET           SERVICE
		120111 svar2 svar2-value gh_user/testApp service2
		120101 var1  var1-val    gh_user/testApp *
		120102 var2  22          gh_user/testApp *
		` + '\n',
		);
		expect(err.join('')).to.equal('');
	});

	it('should successfully list env and service vars for a test fleet (-s flags)', async () => {
		const serviceName = 'service1';
		await api.expectGetServiceFromApp({ serviceName });
		await api.expectGetApplication();
		await api.expectGetAppEnvVars();
		await api.expectGetAppServiceVars();

		const { out, err } = await runCommand(
			`env list -f ${appName} -s ${serviceName}`,
		);

		expect(out.join('')).to.equal(
			stripIndent`
		ID     NAME  VALUE       FLEET           SERVICE
		120110 svar1 svar1-value gh_user/testApp ${serviceName}
		120101 var1  var1-val    gh_user/testApp *
		120102 var2  22          gh_user/testApp *
		` + '\n',
		);
		expect(err.join('')).to.equal('');
	});

	it('should successfully list env variables for a test device', async () => {
		await api.expectGetDevice({ shortUUID, fullUUID });
		await api.expectGetDevice({ fullUUID });
		await api.expectGetDeviceEnvVars();
		await api.expectGetApplication();
		await api.expectGetAppEnvVars();
		await api.expectGetAppServiceVars();
		await api.expectGetDeviceServiceVars();

		const result = await runCommand(`env list -d ${shortUUID}`);
		let { out } = result;
		let expected =
			stripIndent`
			ID     NAME  VALUE       FLEET    DEVICE  SERVICE
			120110 svar1 svar1-value org/test *       service1
			120111 svar2 svar2-value org/test *       service2
			120120 svar3 svar3-value org/test ${shortUUID} service1
			120121 svar4 svar4-value org/test ${shortUUID} service2
			120101 var1  var1-val    org/test *       *
			120102 var2  22          org/test *       *
			120203 var3  var3-val    org/test ${shortUUID} *
			120204 var4  44          org/test ${shortUUID} *
			` + '\n';

		out = out.map((l) => l.replace(/ +/g, ' '));
		expected = expected.replace(/ +/g, ' ');

		expect(out.join('')).to.equal(expected);
	});

	it('should successfully list env variables for a test device (JSON output)', async () => {
		await api.expectGetDevice({ shortUUID, fullUUID });
		await api.expectGetDevice({ fullUUID });
		await api.expectGetDeviceEnvVars();
		await api.expectGetApplication();
		await api.expectGetAppEnvVars();
		await api.expectGetAppServiceVars();
		await api.expectGetDeviceServiceVars();

		const { out, err } = await runCommand(`env list -d ${shortUUID} --json`);
		const expected = `[
			{ "id": 120101, "fleet": "org/test", "deviceUUID": "*", "name": "var1", "value": "var1-val", "serviceName": "*" },
			{ "id": 120102, "fleet": "org/test", "deviceUUID": "*", "name": "var2", "value": "22", "serviceName": "*" },
			{ "id": 120110, "fleet": "org/test", "deviceUUID": "*", "name": "svar1", "value": "svar1-value", "serviceName": "service1" },
			{ "id": 120111, "fleet": "org/test", "deviceUUID": "*", "name": "svar2", "value": "svar2-value", "serviceName": "service2" },
			{ "id": 120120, "fleet": "org/test", "deviceUUID": "${fullUUID}", "name": "svar3", "value": "svar3-value", "serviceName": "service1" },
			{ "id": 120121, "fleet": "org/test", "deviceUUID": "${fullUUID}", "name": "svar4", "value": "svar4-value", "serviceName": "service2" },
			{ "id": 120203, "fleet": "org/test", "deviceUUID": "${fullUUID}", "name": "var3", "value": "var3-val", "serviceName": "*" },
			{ "id": 120204, "fleet": "org/test", "deviceUUID": "${fullUUID}", "name": "var4", "value": "44", "serviceName": "*" }
		]`;

		expect(JSON.parse(out.join(''))).to.deep.equal(JSON.parse(expected));
		expect(err.join('')).to.equal('');
	});

	it('should successfully list config variables for a test device', async () => {
		await api.expectGetDevice({ shortUUID, fullUUID });
		await api.expectGetDevice({ fullUUID });
		await api.expectGetDeviceConfigVars();
		await api.expectGetApplication();
		await api.expectGetAppConfigVars();

		const result = await runCommand(`env list -d ${shortUUID} --config`);
		let { out } = result;
		let expected =
			stripIndent`
			ID     NAME                           VALUE  FLEET       DEVICE
			120300 RESIN_SUPERVISOR_NATIVE_LOGGER false  org/test    *
			120400 RESIN_SUPERVISOR_POLL_INTERVAL 900900 org/test    ${shortUUID}
		` + '\n';

		out = out.map((l) => l.replace(/ +/g, ' '));
		expected = expected.replace(/ +/g, ' ');

		expect(out.join('')).to.equal(expected);
	});

	it('should successfully list service variables for a test device (-s flag)', async () => {
		const serviceName = 'service2';
		await api.expectGetServiceFromApp({ serviceName });
		await api.expectGetApplication();
		await api.expectGetDevice({ shortUUID, fullUUID });
		await api.expectGetDevice({ fullUUID });
		await api.expectGetDeviceServiceVars();
		await api.expectGetAppEnvVars();
		await api.expectGetAppServiceVars();
		await api.expectGetDeviceEnvVars();

		const result = await runCommand(
			`env list -d ${shortUUID} -s ${serviceName}`,
		);
		let { out } = result;
		let expected =
			stripIndent`
			ID     NAME  VALUE       FLEET    DEVICE  SERVICE
			120111 svar2 svar2-value org/test *       service2
			120121 svar4 svar4-value org/test ${shortUUID} service2
			120101 var1  var1-val    org/test *       *
			120102 var2  22          org/test *       *
			120203 var3  var3-val    org/test ${shortUUID} *
			120204 var4  44          org/test ${shortUUID} *
		` + '\n';

		out = out.map((l) => l.replace(/ +/g, ' '));
		expected = expected.replace(/ +/g, ' ');

		expect(out.join('')).to.equal(expected);
	});

	it('should successfully list env and service variables for a test device (unknown fleet)', async () => {
		await api.expectGetDevice({ shortUUID, fullUUID, inaccessibleApp: true });
		await api.expectGetDevice({ fullUUID, inaccessibleApp: true });
		await api.expectGetDeviceEnvVars();
		await api.expectGetDeviceServiceVars();

		const result = await runCommand(`env list -d ${shortUUID}`);
		let { out } = result;
		let expected =
			stripIndent`
			ID     NAME  VALUE       FLEET DEVICE  SERVICE
			120120 svar3 svar3-value N/A   ${shortUUID} service1
			120121 svar4 svar4-value N/A   ${shortUUID} service2
			120203 var3  var3-val    N/A   ${shortUUID} *
			120204 var4  44          N/A   ${shortUUID} *
		` + '\n';

		out = out.map((l) => l.replace(/ +/g, ' '));
		expected = expected.replace(/ +/g, ' ');

		expect(out.join('')).to.equal(expected);
	});

	it('should successfully list env and service vars for a test device (-s flags)', async () => {
		const serviceName = 'service1';
		await api.expectGetServiceFromApp({ serviceName });
		await api.expectGetApplication();
		await api.expectGetAppEnvVars();
		await api.expectGetAppServiceVars();
		await api.expectGetDevice({ shortUUID, fullUUID });
		await api.expectGetDevice({ fullUUID });
		await api.expectGetDeviceEnvVars();
		await api.expectGetDeviceServiceVars();

		const result = await runCommand(
			`env list -d ${shortUUID} -s ${serviceName}`,
		);
		let { out } = result;
		let expected =
			stripIndent`
			ID     NAME  VALUE       FLEET    DEVICE  SERVICE
			120110 svar1 svar1-value org/test *       ${serviceName}
			120120 svar3 svar3-value org/test ${shortUUID} ${serviceName}
			120101 var1  var1-val    org/test *       *
			120102 var2  22          org/test *       *
			120203 var3  var3-val    org/test ${shortUUID} *
			120204 var4  44          org/test ${shortUUID} *
		` + '\n';

		out = out.map((l) => l.replace(/ +/g, ' '));
		expected = expected.replace(/ +/g, ' ');

		expect(out.join('')).to.equal(expected);
	});

	it('should successfully list env and service vars for a test device (-s, --json flags)', async () => {
		const serviceName = 'service1';
		await api.expectGetServiceFromApp({ serviceName });
		await api.expectGetApplication();
		await api.expectGetAppEnvVars();
		await api.expectGetAppServiceVars();
		await api.expectGetDevice({ shortUUID, fullUUID });
		await api.expectGetDevice({ fullUUID });
		await api.expectGetDeviceEnvVars();
		await api.expectGetDeviceServiceVars();

		const { out, err } = await runCommand(
			`env list -d ${shortUUID} -s ${serviceName} --json`,
		);
		const expected = `[
			{ "id": 120101, "fleet": "org/test", "deviceUUID": "*", "name": "var1", "value": "var1-val", "serviceName": "*" },
			{ "id": 120102, "fleet": "org/test", "deviceUUID": "*", "name": "var2", "value": "22", "serviceName": "*" },
			{ "id": 120110, "fleet": "org/test", "deviceUUID": "*", "name": "svar1", "value": "svar1-value", "serviceName": "${serviceName}" },
			{ "id": 120120, "fleet": "org/test", "deviceUUID": "${fullUUID}", "name": "svar3", "value": "svar3-value", "serviceName": "${serviceName}" },
			{ "id": 120203, "fleet": "org/test", "deviceUUID": "${fullUUID}", "name": "var3", "value": "var3-val", "serviceName": "*" },
			{ "id": 120204, "fleet": "org/test", "deviceUUID": "${fullUUID}", "name": "var4", "value": "44", "serviceName": "*" }
		]`;

		expect(JSON.parse(out.join(''))).to.deep.equal(JSON.parse(expected));
		expect(err.join('')).to.equal('');
	});
});
