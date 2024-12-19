/**
 * @license
 * Copyright 2020-2021 Balena Ltd.
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
import * as process from 'process';
import { runCommand } from '../../helpers';
import { promisify } from 'util';
import * as tmp from 'tmp';
import * as stripIndent from 'common-tags/lib/stripIndent';

tmp.setGracefulCleanup();
const tmpNameAsync = promisify(tmp.tmpName);

import { BalenaAPIMock } from '../../nock/balena-api-mock';

if (process.platform !== 'win32') {
	describe('balena os configure', function () {
		let api: BalenaAPIMock;
		let tmpPath: string;

		beforeEach(async () => {
			api = new BalenaAPIMock();
			api.expectGetWhoAmI({ optional: true, persist: true });
			tmpPath = (await tmpNameAsync()) as string;
			await fs.copyFile('./tests/test-data/dummy.img', tmpPath);
		});

		afterEach(async () => {
			api.done();
			await fs.unlink(tmpPath);
		});

		it('should inject a valid config.json file', async () => {
			api.expectGetApplication();
			api.expectGetConfigDeviceTypes();
			api.expectDownloadConfig();

			const command: string[] = [
				`os configure ${tmpPath}`,
				'--device-type raspberrypi3',
				'--version 2.47.0+rev1',
				'--fleet testApp',
				'--config-app-update-poll-interval 10',
				'--config-network ethernet',
				'--initial-device-name testDeviceName',
				'--provisioning-key-name testKey',
				'--provisioning-key-expiry-date 2050-12-12',
			];

			const { err } = await runCommand(command.join(' '));
			// Once we replace the dummy.img with one that includes a os-release & device-type.json
			// then we should be able to change this to expect no errors.
			expect(
				err.flatMap((line) => line.split('\n')).filter((line) => line !== ''),
			).to.deep.equal(
				stripIndent`
					[warn] "${tmpPath}":
					[warn]   1 partition(s) found, but none containing file "/device-type.json".
					[warn]   Assuming default boot partition number '1'.
					[warn] "${tmpPath}":
					[warn]   Could not find a previous "/config.json" file in partition '1'.
					[warn]   Proceeding anyway, but this is unexpected.`.split('\n'),
			);

			// confirm the image contains a config.json...
			const imagefs = await import('balena-image-fs');
			const config = await imagefs.interact(tmpPath, 1, async (_fs) => {
				return await promisify(_fs.readFile)('/config.json');
			});
			expect(config).to.not.be.empty;

			// confirm the image has the correct config.json values...
			const configObj = JSON.parse(config.toString('utf8'));
			expect(configObj).to.have.property('deviceType', 'raspberrypi3');
			expect(configObj).to.have.property('initialDeviceName', 'testDeviceName');
		});
	});
}
