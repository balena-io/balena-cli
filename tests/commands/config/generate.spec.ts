/**
 * @license
 * Copyright 2020-2026 Balena Ltd.
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
import { promises as fs } from 'fs';
import { runCommand } from '../../helpers.js';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { stripIndent } from '../../../build/utils/lazy';
import { randomUUID } from 'node:crypto';

import { MockHttpServer } from '../../mockserver.js';

describe('balena os generate', function () {
	let api: MockHttpServer['api'];
	let server: MockHttpServer;

	beforeEach(async () => {
		server = new MockHttpServer();
		api = server.api;
		await server.start();
		await api.expectGetWhoAmI({ optional: true, persist: true });
	});

	afterEach(async () => {
		await server.stop();
	});

	it('should generate a config.json with --fleet --network ethernet without interactive questions', async () => {
		await api.expectGetApplication();
		await api.expectGetDeviceTypes();
		await api.expectGetConfigDeviceTypes();
		await api.expectDownloadConfig();

		await using tmpDir = await fs.mkdtempDisposable(
			path.join(tmpdir(), 'config-generate-tests'),
		);
		const tmpConfigJsonPath = path.join(tmpDir.path, 'config.json');

		const command: string[] = [
			`config generate`,
			`--fleet testApp`,
			`--version 2.12.7`,
			`--network ethernet`,
			`--appUpdatePollInterval 15`,
			`--output ${tmpConfigJsonPath}`,
		];

		const { out, err } = await runCommand(command.join(' '));
		expect(out.join('')).to.equal(
			stripIndent`
			applicationId:         1301645
			deviceType:            raspberrypi3
			userId:                43699
			appUpdatePollInterval: 900000
			listenPort:            48484
			vpnPort:               443
			apiEndpoint:           https://api.balena-cloud.com
			vpnEndpoint:           vpn.balena-cloud.com
			registryEndpoint:      registry2.balena-cloud.com
			deltaEndpoint:         https://delta.balena-cloud.com
			apiKey:                nothingtoseehere
		` + '\n',
		);
		expect(err.join('')).to.equal('');

		const downloadedContent = await fs.readFile(tmpConfigJsonPath, 'utf8');
		expect(JSON.parse(downloadedContent)).to.deep.equal({
			applicationId: 1301645,
			deviceType: 'raspberrypi3',
			userId: 43699,
			appUpdatePollInterval: 900000,
			listenPort: 48484,
			vpnPort: 443,
			apiEndpoint: 'https://api.balena-cloud.com',
			vpnEndpoint: 'vpn.balena-cloud.com',
			registryEndpoint: 'registry2.balena-cloud.com',
			deltaEndpoint: 'https://delta.balena-cloud.com',
			apiKey: 'nothingtoseehere',
		});
	});

	it('should generate a config.json with --fleet --network wifi without interactive questions', async () => {
		await api.expectGetApplication();
		await api.expectGetDeviceTypes();
		await api.expectGetConfigDeviceTypes();
		await api.expectDownloadConfig();

		await using tmpDir = await fs.mkdtempDisposable(
			path.join(tmpdir(), 'config-generate-tests'),
		);
		const tmpConfigJsonPath = path.join(tmpDir.path, 'config.json');

		const wifiSsid = `wifiSsid-${randomUUID()}`;
		const wifiKey = `wifiKey-${randomUUID()}`;

		const command: string[] = [
			`config generate`,
			`--fleet testApp`,
			`--version 2.12.7`,
			`--network wifi`,
			`--wifiSsid ${wifiSsid}`,
			`--wifiKey ${wifiKey}`,
			`--appUpdatePollInterval 15`,
			`--output ${tmpConfigJsonPath}`,
		];

		const { out, err } = await runCommand(command.join(' '));
		expect(out.join('')).to.equal(
			stripIndent`
			applicationId:         1301645
			deviceType:            raspberrypi3
			userId:                43699
			appUpdatePollInterval: 900000
			listenPort:            48484
			vpnPort:               443
			apiEndpoint:           https://api.balena-cloud.com
			vpnEndpoint:           vpn.balena-cloud.com
			registryEndpoint:      registry2.balena-cloud.com
			deltaEndpoint:         https://delta.balena-cloud.com
			apiKey:                nothingtoseehere
			wifiSsid:              ${wifiSsid}
			wifiKey:               ${wifiKey}
		` + '\n',
		);
		expect(err.join('')).to.equal('');

		const downloadedContent = await fs.readFile(tmpConfigJsonPath, 'utf8');
		expect(JSON.parse(downloadedContent)).to.deep.equal({
			applicationId: 1301645,
			deviceType: 'raspberrypi3',
			userId: 43699,
			appUpdatePollInterval: 900000,
			listenPort: 48484,
			vpnPort: 443,
			apiEndpoint: 'https://api.balena-cloud.com',
			vpnEndpoint: 'vpn.balena-cloud.com',
			registryEndpoint: 'registry2.balena-cloud.com',
			deltaEndpoint: 'https://delta.balena-cloud.com',
			apiKey: 'nothingtoseehere',
			wifiSsid,
			wifiKey,
		});
	});
});
