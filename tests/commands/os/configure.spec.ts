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
import type * as $imagefs from 'balena-image-fs';

tmp.setGracefulCleanup();
const tmpNameAsync = promisify(tmp.tmpName);

import { BalenaAPIMock } from '../../nock/balena-api-mock';

if (process.platform !== 'win32') {
	describe('balena os configure', function () {
		let imagefs: typeof $imagefs;
		let api: BalenaAPIMock;
		let tmpDummyPath: string;
		let tmpMatchingDtJsonPartitionPath: string;

		before(async function () {
			// We conditionally import balena-image-fs, since when imported on top level then unrelated tests on win32 failed with:
			// EPERM: operation not permitted, rename 'C:\Users\RUNNER~1\AppData\Local\Temp\tmp-<...>.inprogress' -> 'C:\Users\RUNNER~1\AppData\Local\Temp\tmp-<...>'
			//    at async Object.rename (node:internal/fs/promises:782:10) {
			imagefs = await import('balena-image-fs');
			tmpDummyPath = (await tmpNameAsync()) as string;
			await fs.copyFile('./tests/test-data/dummy.img', tmpDummyPath);
			tmpMatchingDtJsonPartitionPath = (await tmpNameAsync()) as string;
			await fs.copyFile(
				'./tests/test-data/mock-jetson-nano-6.0.13.with-boot-partition-12.img',
				tmpMatchingDtJsonPartitionPath,
			);
		});

		beforeEach(() => {
			api = new BalenaAPIMock();
			api.expectGetWhoAmI({ optional: true, persist: true });
		});

		afterEach(() => {
			api.done();
		});

		after(async () => {
			await fs.unlink(tmpDummyPath);
			await fs.unlink(tmpMatchingDtJsonPartitionPath);
		});

		it('should inject a valid config.json file to an image with partition 12 as boot & matching device-type.json ', async () => {
			api.expectGetApplication();
			api.expectGetDeviceTypes();
			// TODO: this shouldn't be necessary & the CLI should be able to find
			// everything required from the device-type.json in the image.
			api.expectGetConfigDeviceTypes();
			api.expectDownloadConfig();

			const command: string[] = [
				`os configure ${tmpMatchingDtJsonPartitionPath}`,
				'--device-type jetson-nano',
				'--version 6.0.13',
				'--fleet testApp',
				'--config-app-update-poll-interval 10',
				'--config-network ethernet',
				'--initial-device-name testDeviceName',
				'--provisioning-key-name testKey',
				'--provisioning-key-expiry-date 2050-12-12',
			];

			const { err } = await runCommand(command.join(' '));
			expect(err.join('')).to.equal('');

			// confirm the image contains a config.json...
			const config = await imagefs.interact(
				tmpMatchingDtJsonPartitionPath,
				12,
				async (_fs) => {
					const readFileAsync = promisify(_fs.readFile);
					const dtJson = JSON.parse(
						await readFileAsync('/device-type.json', { encoding: 'utf8' }),
					);
					// confirm that the device-type.json mentions the expected partition
					expect(dtJson).to.have.nested.property(
						'configuration.config.partition',
						12,
					);
					return await readFileAsync('/config.json');
				},
			);
			expect(config).to.not.be.empty;

			// confirm the image has the correct config.json values...
			const configObj = JSON.parse(config.toString('utf8'));
			expect(configObj).to.have.property('deviceType', 'jetson-nano');
			expect(configObj).to.have.property('initialDeviceName', 'testDeviceName');
		});

		// TODO: In the next major consider just failing when we can't find a device-types.json in the image.
		it('should inject a valid config.json file to a dummy image', async () => {
			api.expectGetApplication();
			// Since the dummy image doesn't include a device-type.json
			// we have to reach to the API to fetch the manifest of the device type.
			api.expectGetConfigDeviceTypes();
			api.expectDownloadConfig();

			const command: string[] = [
				`os configure ${tmpDummyPath}`,
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
			expect(err.join('')).to.equal('');

			// confirm the image contains a config.json...
			const config = await imagefs.interact(tmpDummyPath, 1, async (_fs) => {
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
