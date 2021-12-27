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
import { runCommand, removeFirstNLines, trimLines } from '../../helpers';

import { isV14 } from '../../../lib/utils/version';

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

	it('should successfully list env vars for a test fleet', async () => {
		api.expectGetApplication();
		api.expectGetAppEnvVars();
		api.expectGetAppServiceVars();

		const { out, err } = await runCommand(`envs -f ${appName}`);

		if (isV14()) {
			let output = out.join('');
			output = trimLines(removeFirstNLines(output, 2));

			const expected =
				stripIndent`
			120110 svar1 svar1-value gh_user/testApp service1
			120111 svar2 svar2-value gh_user/testApp service2
			120101 var1  var1-val    gh_user/testApp *
			120102 var2  22          gh_user/testApp *
		` + '\n';

			expect(output).to.equal(expected);
		} else {
			expect(out.join('')).to.equal(
				stripIndent`
			ID     NAME  VALUE       FLEET           SERVICE
			120110 svar1 svar1-value gh_user/testApp service1
			120111 svar2 svar2-value gh_user/testApp service2
			120101 var1  var1-val    gh_user/testApp *
			120102 var2  22          gh_user/testApp *
		` + '\n',
			);
		}
		expect(err.join('')).to.equal('');
	});

	it('should successfully list config vars for a test fleet', async () => {
		api.expectGetApplication();
		api.expectGetAppConfigVars();

		const { out, err } = await runCommand(`envs -f ${appName} --config`);

		if (isV14()) {
			let output = out.join('');
			output = trimLines(removeFirstNLines(output, 2));

			const expected =
				stripIndent`
			120300 RESIN_SUPERVISOR_NATIVE_LOGGER false gh_user/testApp
		` + '\n';

			expect(output).to.equal(expected);
		} else {
			expect(out.join('')).to.equal(
				stripIndent`
			ID     NAME                           VALUE FLEET
			120300 RESIN_SUPERVISOR_NATIVE_LOGGER false gh_user/testApp
		` + '\n',
			);
		}

		expect(err.join('')).to.equal('');
	});

	it('should successfully list config vars for a test fleet (JSON output)', async () => {
		api.expectGetApplication();
		api.expectGetAppConfigVars();

		const { out, err } = await runCommand(`envs -cjf ${appName}`);

		if (isV14()) {
			// TODO: Add tests once oclif json issue resolved.
		} else {
			expect(JSON.parse(out.join(''))).to.deep.equal([
				{
					fleet: 'gh_user/testApp',
					id: 120300,
					name: 'RESIN_SUPERVISOR_NATIVE_LOGGER',
					value: 'false',
				},
			]);
			expect(err.join('')).to.equal('');
		}
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

		if (isV14()) {
			let output = out.join('');
			output = trimLines(removeFirstNLines(output, 2));

			const expected =
				stripIndent`
		120111 svar2 svar2-value gh_user/testApp service2
		120101 var1  var1-val    gh_user/testApp *
		120102 var2  22          gh_user/testApp *
		` + '\n';

			expect(output).to.equal(expected);
		} else {
			expect(out.join('')).to.equal(
				stripIndent`
		ID     NAME  VALUE       FLEET           SERVICE
		120111 svar2 svar2-value gh_user/testApp service2
		120101 var1  var1-val    gh_user/testApp *
		120102 var2  22          gh_user/testApp *
		` + '\n',
			);
		}
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

		if (isV14()) {
			let output = out.join('');
			output = trimLines(removeFirstNLines(output, 2));

			const expected =
				stripIndent`
		120110 svar1 svar1-value gh_user/testApp ${serviceName}
		120101 var1  var1-val    gh_user/testApp *
		120102 var2  22          gh_user/testApp *
		` + '\n';

			expect(output).to.equal(expected);
		} else {
			expect(out.join('')).to.equal(
				stripIndent`
		ID     NAME  VALUE       FLEET           SERVICE
		120110 svar1 svar1-value gh_user/testApp ${serviceName}
		120101 var1  var1-val    gh_user/testApp *
		120102 var2  22          gh_user/testApp *
		` + '\n',
			);
		}
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
		let { out } = result;

		if (isV14()) {
			let output = out.join('');
			output = trimLines(removeFirstNLines(output, 2));

			const expected =
				stripIndent`
			120110 svar1 svar1-value org/test *       service1
			120111 svar2 svar2-value org/test *       service2
			120120 svar3 svar3-value org/test ${uuid} service1
			120121 svar4 svar4-value org/test ${uuid} service2
			120101 var1  var1-val    org/test *       *
			120102 var2  22          org/test *       *
			120203 var3  var3-val    org/test ${uuid} *
			120204 var4  44          org/test ${uuid} *
		` + '\n';

			expect(output).to.equal(expected);
		} else {
			let expected =
				stripIndent`
			ID     NAME  VALUE       FLEET    DEVICE  SERVICE
			120110 svar1 svar1-value org/test *       service1
			120111 svar2 svar2-value org/test *       service2
			120120 svar3 svar3-value org/test ${uuid} service1
			120121 svar4 svar4-value org/test ${uuid} service2
			120101 var1  var1-val    org/test *       *
			120102 var2  22          org/test *       *
			120203 var3  var3-val    org/test ${uuid} *
			120204 var4  44          org/test ${uuid} *
			` + '\n';

			out = out.map((l) => l.replace(/ +/g, ' '));
			expected = expected.replace(/ +/g, ' ');
			expect(out.join('')).to.equal(expected);
		}
	});

	it('should successfully list env variables for a test device (JSON output)', async () => {
		api.expectGetDevice({ fullUUID });
		api.expectGetDeviceEnvVars();
		api.expectGetApplication();
		api.expectGetAppEnvVars();
		api.expectGetAppServiceVars();
		api.expectGetDeviceServiceVars();

		const { out, err } = await runCommand(`envs -jd ${shortUUID}`);

		if (isV14()) {
			// TODO: Add tests once oclif json issue resolved.
		} else {
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
		}

		expect(err.join('')).to.equal('');
	});

	it('should successfully list config variables for a test device', async () => {
		api.expectGetDevice({ fullUUID });
		api.expectGetDeviceConfigVars();
		api.expectGetApplication();
		api.expectGetAppConfigVars();

		const result = await runCommand(`envs -d ${shortUUID} --config`);
		let { out } = result;
		if (isV14()) {
			let output = out.join('');
			output = trimLines(removeFirstNLines(output, 2));

			const expected =
				stripIndent`
			120300 RESIN_SUPERVISOR_NATIVE_LOGGER false  org/test *
			120400 RESIN_SUPERVISOR_POLL_INTERVAL 900900 org/test ${shortUUID}
		` + '\n';

			expect(output).to.equal(expected);
		} else {
			let expected =
				stripIndent`
			ID     NAME                           VALUE  FLEET       DEVICE
			120300 RESIN_SUPERVISOR_NATIVE_LOGGER false  org/test    *
			120400 RESIN_SUPERVISOR_POLL_INTERVAL 900900 org/test    ${shortUUID}
		` + '\n';

			out = out.map((l) => l.replace(/ +/g, ' '));
			expected = expected.replace(/ +/g, ' ');

			expect(out.join('')).to.equal(expected);
		}
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
		let { out } = result;

		if (isV14()) {
			let output = out.join('');
			output = trimLines(removeFirstNLines(output, 2));

			const expected =
				stripIndent`
			120111 svar2 svar2-value org/test *       service2
			120121 svar4 svar4-value org/test ${uuid} service2
			120101 var1  var1-val    org/test *       *
			120102 var2  22          org/test *       *
			120203 var3  var3-val    org/test ${uuid} *
			120204 var4  44          org/test ${uuid} *
		` + '\n';

			expect(output).to.equal(expected);
		} else {
			let expected =
				stripIndent`
			ID     NAME  VALUE       FLEET    DEVICE  SERVICE
			120111 svar2 svar2-value org/test *       service2
			120121 svar4 svar4-value org/test ${uuid} service2
			120101 var1  var1-val    org/test *       *
			120102 var2  22          org/test *       *
			120203 var3  var3-val    org/test ${uuid} *
			120204 var4  44          org/test ${uuid} *
		` + '\n';

			out = out.map((l) => l.replace(/ +/g, ' '));
			expected = expected.replace(/ +/g, ' ');

			expect(out.join('')).to.equal(expected);
		}
	});

	it('should successfully list env and service variables for a test device (unknown fleet)', async () => {
		api.expectGetDevice({ fullUUID, inaccessibleApp: true });
		api.expectGetDeviceEnvVars();
		api.expectGetDeviceServiceVars();

		const uuid = shortUUID;
		const result = await runCommand(`envs -d ${uuid}`);
		let { out } = result;

		if (isV14()) {
			let output = out.join('');
			output = trimLines(removeFirstNLines(output, 2));

			const expected =
				stripIndent`
			120120 svar3 svar3-value N/A   ${uuid} service1
			120121 svar4 svar4-value N/A   ${uuid} service2
			120203 var3  var3-val    N/A   ${uuid} *
			120204 var4  44          N/A   ${uuid} *
		` + '\n';

			expect(output).to.equal(expected);
		} else {
			let expected =
				stripIndent`
			ID     NAME  VALUE       FLEET DEVICE  SERVICE
			120120 svar3 svar3-value N/A   ${uuid} service1
			120121 svar4 svar4-value N/A   ${uuid} service2
			120203 var3  var3-val    N/A   ${uuid} *
			120204 var4  44          N/A   ${uuid} *
		` + '\n';

			out = out.map((l) => l.replace(/ +/g, ' '));
			expected = expected.replace(/ +/g, ' ');

			expect(out.join('')).to.equal(expected);
		}
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
		let { out } = result;
		if (isV14()) {
			let output = out.join('');
			output = trimLines(removeFirstNLines(output, 2));

			const expected =
				stripIndent`
			120110 svar1 svar1-value org/test *       ${serviceName}
			120120 svar3 svar3-value org/test ${uuid} ${serviceName}
			120101 var1  var1-val    org/test *       *
			120102 var2  22          org/test *       *
			120203 var3  var3-val    org/test ${uuid} *
			120204 var4  44          org/test ${uuid} *
		` + '\n';

			expect(output).to.equal(expected);
		} else {
			let expected =
				stripIndent`
			ID     NAME  VALUE       FLEET    DEVICE  SERVICE
			120110 svar1 svar1-value org/test *       ${serviceName}
			120120 svar3 svar3-value org/test ${uuid} ${serviceName}
			120101 var1  var1-val    org/test *       *
			120102 var2  22          org/test *       *
			120203 var3  var3-val    org/test ${uuid} *
			120204 var4  44          org/test ${uuid} *
		` + '\n';

			out = out.map((l) => l.replace(/ +/g, ' '));
			expected = expected.replace(/ +/g, ' ');

			expect(out.join('')).to.equal(expected);
		}
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

		if (isV14()) {
			// TODO: Add tests once oclif json issue resolved.
		} else {
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
		}
	});
});
