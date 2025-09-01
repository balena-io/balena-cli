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
import * as stripIndent from 'common-tags/lib/stripIndent';

tmp.setGracefulCleanup();
const tmpNameAsync = promisify(tmp.tmpName);

import { BalenaAPIMock } from '../../nock/balena-api-mock';

if (process.platform !== 'win32') {
	describe('balena os configure', function () {
		let imagefs: typeof $imagefs;
		let api: BalenaAPIMock;
		let tmpDummyPath: string;
		let tmpMatchingDtJsonPartitionPath: string;
		let tmpNonMatchingDtJsonPartitionPath: string;

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

			tmpNonMatchingDtJsonPartitionPath = (await tmpNameAsync()) as string;
			// Create an image with a device-type.json that mentions a non matching boot partition.
			// We copy the pre-existing image and modify it, since including a separate one
			// would add 18MB more to the repository.
			await fs.copyFile(
				'./tests/test-data/mock-jetson-nano-6.0.13.with-boot-partition-12.img',
				tmpNonMatchingDtJsonPartitionPath,
			);
			await imagefs.interact(
				tmpNonMatchingDtJsonPartitionPath,
				12,
				async (_fs) => {
					const dtJson = JSON.parse(
						await _fs.promises.readFile('/device-type.json', {
							encoding: 'utf8',
						}),
					);
					expect(dtJson).to.have.nested.property(
						'configuration.config.partition',
						12,
					);
					dtJson.configuration.config.partition = 999;
					await _fs.promises.writeFile(
						'/device-type.json',
						JSON.stringify(dtJson),
					);

					await _fs.promises.writeFile(
						'/os-release',
						stripIndent`
							ID="balena-os"
							NAME="balenaOS"
							VERSION="6.1.25"
							VERSION_ID="6.1.25"
							PRETTY_NAME="balenaOS 6.1.25"
							DISTRO_CODENAME="kirkstone"
							MACHINE="jetson-nano"
							META_BALENA_VERSION="6.1.25"`,
					);
				},
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
			await fs.unlink(tmpNonMatchingDtJsonPartitionPath);
		});

		it('should fail when the provided image path does not exist', async () => {
			const tmpInvalidImagePath = `${tmpMatchingDtJsonPartitionPath}wrong.img`;
			const command: string[] = [
				`os configure ${tmpInvalidImagePath}`,
				'--device-type jetson-nano',
				'--fleet testApp',
			];

			const { err } = await runCommand(command.join(' '));
			expect(
				err.flatMap((line) => line.split('\n')).filter((line) => line !== ''),
			).to.deep.equal([`No such file: ${tmpInvalidImagePath}`]);
		});

		it('should fail when the provided image path is a directory', async () => {
			const tmpInvalidImagePath = tmpMatchingDtJsonPartitionPath.replace(
				/\/[^/]+$/,
				'',
			);
			const command: string[] = [
				`os configure ${tmpInvalidImagePath}`,
				'--device-type jetson-nano',
				'--fleet testApp',
			];

			const { err } = await runCommand(command.join(' '));
			expect(
				err.flatMap((line) => line.split('\n')).filter((line) => line !== ''),
			).to.deep.equal([
				`Path is not pointing to a file: ${tmpInvalidImagePath}`,
			]);
		});

		it('should fail when the provided config path does not exist', async () => {
			const tmpInvalidConfigJsonPath = `${tmpMatchingDtJsonPartitionPath}wrong-config.json`;
			const command: string[] = [
				`os configure ${tmpMatchingDtJsonPartitionPath}`,
				'--device-type jetson-nano',
				'--fleet testApp',
				`--config ${tmpInvalidConfigJsonPath}`,
			];

			const { err } = await runCommand(command.join(' '));
			expect(
				err.flatMap((line) => line.split('\n')).filter((line) => line !== ''),
			).to.deep.equal([`No such file: ${tmpInvalidConfigJsonPath}`]);
		});

		it('should detect the OS version and inject a valid config.json file to a 6.0.13 image with partition 12 as boot & matching device-type.json', async () => {
			api.expectGetApplication();
			api.expectGetDeviceTypes();
			// It should not reach to /config or /device-types/v1 but instead find
			// everything required from the device-type.json in the image.
			// api.expectGetConfigDeviceTypes();
			api.expectDownloadConfig();

			const command: string[] = [
				`os configure ${tmpMatchingDtJsonPartitionPath}`,
				'--device-type jetson-nano',
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
					const dtJson = JSON.parse(
						await _fs.promises.readFile('/device-type.json', {
							encoding: 'utf8',
						}),
					);
					// confirm that the device-type.json mentions the expected partition
					expect(dtJson).to.have.nested.property(
						'configuration.config.partition',
						12,
					);
					return await _fs.promises.readFile('/config.json');
				},
			);
			expect(config).to.not.be.empty;

			// confirm the image has the correct config.json values...
			const configObj = JSON.parse(config.toString('utf8'));
			expect(configObj).to.have.property('deviceType', 'jetson-nano');
			expect(configObj).to.have.property('initialDeviceName', 'testDeviceName');
		});

		it('should detect the OS version and inject a valid config.json file to a 6.1.25 image with partition 12 as boot & a non-matching device-type.json', async () => {
			api.expectGetApplication();
			api.expectGetDeviceTypes();
			// It should not reach to /config or /device-types/v1 but instead find
			// everything required from the device-type.json in the image.
			// api.expectGetConfigDeviceTypes();
			api.expectDownloadConfig();

			const command: string[] = [
				`os configure ${tmpNonMatchingDtJsonPartitionPath}`,
				'--device-type jetson-nano',
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
				tmpNonMatchingDtJsonPartitionPath,
				12,
				async (_fs) => {
					const dtJson = JSON.parse(
						await _fs.promises.readFile('/device-type.json', {
							encoding: 'utf8',
						}),
					);
					// confirm that the device-type.json mentions the expected partition
					expect(dtJson).to.have.nested.property(
						'configuration.config.partition',
						999,
					);
					return await _fs.promises.readFile('/config.json');
				},
			);
			expect(config).to.not.be.empty;

			// confirm the image has the correct config.json values...
			const configObj = JSON.parse(config.toString('utf8'));
			expect(configObj).to.have.property('deviceType', 'jetson-nano');
			expect(configObj).to.have.property('initialDeviceName', 'testDeviceName');
		});

		it('should fail when it can not detect the OS version of the provided image', async () => {
			api.expectGetApplication();

			const command: string[] = [
				`os configure ${tmpDummyPath}`,
				'--device-type raspberrypi3',
				'--fleet testApp',
			];

			const { err } = await runCommand(command.join(' '));
			// Once we replace the dummy.img with one that includes a os-release & device-type.json
			// then we should be able to change this to expect no errors.
			expect(
				err.flatMap((line) => line.split('\n')).filter((line) => line !== ''),
			).to.deep.equal(
				stripIndent`
					[warn] "${tmpDummyPath}":
					[warn]   Found partition table with 1 partitions,
					[warn]   but none with a name/label in ['resin-boot', 'flash-boot', 'balena-boot'].
					[warn]   Will scan all partitions for contents.
					[warn] "${tmpDummyPath}":
					[warn]   1 partition(s) found, but none containing file "/device-type.json".
					[warn]   Assuming default boot partition number '1'.
					[warn] "${tmpDummyPath}":
					[warn]   Could not find a previous "/config.json" file in partition '1'.
					[warn]   Proceeding anyway, but this is unexpected.
					Error while finding a device-type.json on the provided image path.`.split('\n'),
			);
		});
	});
}
