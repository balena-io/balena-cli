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
import { runCommand } from '../../helpers.js';
import { promisify } from 'util';
import * as tmp from 'tmp';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import type * as $imagefs from 'balena-image-fs';
import { stripIndent } from '../../../build/utils/lazy';
import { randomUUID } from 'node:crypto';

tmp.setGracefulCleanup();
const tmpNameAsync = promisify(tmp.tmpName);

import { MockHttpServer } from '../../mockserver.js';

if (process.platform !== 'win32') {
	describe('balena os configure', function () {
		let imagefs: typeof $imagefs;

		const testImageFilenames = {
			dummy: 'dummy.img',
			genericAmd64: 'mock-generic-amd64-6.8.1.img',
			intelNuc: 'mock-intel-nuc-6.8.0.img',
			jetsonNanoMatchingDtJsonPartition:
				'mock-jetson-nano-6.0.13.with-boot-partition-12.img',
			jetsonNanoNonMatchingDtJsonPartition:
				'mock-jetson-nano-6.0.13.with-boot-partition-12.img',
		};

		const tmpImagePaths = {
			...testImageFilenames,
		};
		let api: MockHttpServer['api'];
		let server: MockHttpServer;

		before(async function () {
			// We conditionally import balena-image-fs, since when imported on top level then unrelated tests on win32 failed with:
			// EPERM: operation not permitted, rename 'C:\Users\RUNNER~1\AppData\Local\Temp\tmp-<...>.inprogress' -> 'C:\Users\RUNNER~1\AppData\Local\Temp\tmp-<...>'
			//    at async Object.rename (node:internal/fs/promises:782:10) {
			imagefs = await import('balena-image-fs');

			for (const key of Object.keys(testImageFilenames) as Array<
				keyof typeof testImageFilenames
			>) {
				const imagePath = testImageFilenames[key];
				tmpImagePaths[key] = (await tmpNameAsync()) as string;
				await fs.copyFile(`./tests/test-data/${imagePath}`, tmpImagePaths[key]);
			}

			// Create an image with a device-type.json that mentions a non matching boot partition.
			// We copy the pre-existing image and modify it, since including a separate one
			// would add 18MB more to the repository.
			await imagefs.interact(
				tmpImagePaths.jetsonNanoNonMatchingDtJsonPartition,
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

		beforeEach(async () => {
			server = new MockHttpServer();
			api = server.api;
			await server.start();
			await api.expectGetWhoAmI({ optional: true, persist: true });
		});

		afterEach(async () => {
			await server.stop();
		});

		after(async () => {
			for (const tmpImagePath of Object.values(tmpImagePaths)) {
				await fs.unlink(tmpImagePath);
			}
		});

		// Tests the "See more help" custom error generation
		it('should fail when not provising any parameter', async () => {
			const { err } = await runCommand('os configure');
			expect(
				err.flatMap((line) => line.split('\n')).filter((line) => line !== ''),
			).to.deep.equal(
				stripIndent`
				Missing 1 required argument:
				image : path to a balenaOS image file, e.g. "rpi3.img"

				Note: --system-connection allows multiple values. Because of this you need to provide all arguments before providing that flag.
				Alternatively, you can use "--" to signify the end of the flags and the beginning of arguments.
				See more help with \`balena os configure --help\`
			`
					.split('\n')
					.filter((line: string) => line !== ''),
			);
		});

		it('should fail when the provided image path does not exist', async () => {
			const tmpInvalidImagePath = `${tmpImagePaths.jetsonNanoMatchingDtJsonPartition}wrong.img`;
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
			const tmpInvalidImagePath =
				tmpImagePaths.jetsonNanoMatchingDtJsonPartition.replace(/\/[^/]+$/, '');
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
			const tmpInvalidConfigJsonPath = `${tmpImagePaths.jetsonNanoMatchingDtJsonPartition}wrong-config.json`;
			const command: string[] = [
				`os configure ${tmpImagePaths.jetsonNanoMatchingDtJsonPartition}`,
				`--config ${tmpInvalidConfigJsonPath}`,
			];

			const { err } = await runCommand(command.join(' '));
			expect(
				err.flatMap((line) => line.split('\n')).filter((line) => line !== ''),
			).to.deep.equal([`No such file: ${tmpInvalidConfigJsonPath}`]);
		});

		it('should fail when none of the --device, --fleet, --config is provided', async () => {
			const command: string[] = [
				`os configure ${tmpImagePaths.jetsonNanoMatchingDtJsonPartition}`,
			];

			const { err } = await runCommand(command.join(' '));
			expect(
				err.flatMap((line) => line.split('\n')).filter((line) => line !== ''),
			).to.deep.equal([
				`One of the '--device', '--fleet' or '--config' options must be provided`,
			]);
		});

		for (const [argName, argValue] of [
			['--fleet', 'testApp'],
			['--device', '666c3ca42add4d39a0b638fd8562051d'],
			['--device-type', 'jetson-nano'],
		]) {
			it(`should fail combining --config with ${argName}`, async () => {
				const command: string[] = [
					`os configure ${tmpImagePaths.jetsonNanoMatchingDtJsonPartition}`,
					`${argName} ${argValue}`,
					`--config ${tmpImagePaths.jetsonNanoMatchingDtJsonPartition}`,
				];

				const { err } = await runCommand(command.join(' '));
				expect(
					err.flatMap((line) => line.split('\n')).filter((line) => line !== ''),
				).to.deep.equal(
					(argName === '--device-type'
						? stripIndent`
							The following errors occurred:
							  ${argName}=${argValue} cannot also be provided when using --config
							  All of the following must be provided when using --device-type: --fleet
							See more help with --help`
						: stripIndent`
							The following errors occurred:
							  --config=${tmpImagePaths.jetsonNanoMatchingDtJsonPartition} cannot also be provided when using ${argName}
							  ${argName}=${argValue} cannot also be provided when using --config
							See more help with --help`
					).split('\n'),
				);
			});
		}

		it('should fail when combining --device and --device-type', async () => {
			const command: string[] = [
				`os configure ${tmpImagePaths.jetsonNanoMatchingDtJsonPartition}`,
				'--device 276cc21e71574fd3802279ca11134c96',
				'--device-type jetson-nano',
			];

			const { err } = await runCommand(command.join(' '));
			expect(
				err.flatMap((line) => line.split('\n')).filter((line) => line !== ''),
			).to.deep.equal(
				stripIndent`
					The following errors occurred:
					  --device-type=jetson-nano cannot also be provided when using --device
					  All of the following must be provided when using --device-type: --fleet
					See more help with --help`.split('\n'),
			);
		});

		it('should detect the OS version and inject a valid config.json file to a jetson-nano 6.0.13 image with partition 12 as boot & matching device-type.json', async () => {
			await api.expectGetApplication();
			await api.expectGetDeviceTypes();
			// It should not reach to /config or /device-types/v1 but instead find
			// everything required from the device-type.json in the image.
			await api.expectDownloadConfig();

			const command: string[] = [
				`os configure ${tmpImagePaths.jetsonNanoMatchingDtJsonPartition}`,
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
				tmpImagePaths.jetsonNanoMatchingDtJsonPartition,
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

		it('should detect the OS version and inject a valid config.json file to a jetson-nano 6.1.25 image with partition 12 as boot & a non-matching device-type.json', async () => {
			await api.expectGetApplication();
			await api.expectGetDeviceTypes();
			// It should not reach to /config or /device-types/v1 but instead find
			// everything required from the device-type.json in the image.
			await api.expectDownloadConfig();

			const command: string[] = [
				`os configure ${tmpImagePaths.jetsonNanoNonMatchingDtJsonPartition}`,
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
				tmpImagePaths.jetsonNanoNonMatchingDtJsonPartition,
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

		it('should detect the OS version and inject a valid config.json file to an intel-nuc (MBR) image', async () => {
			await api.expectGetApplication();
			await api.expectGetDeviceTypes();
			// It should not reach to /config or /device-types/v1 but instead find
			// everything required from the device-type.json in the image.
			await api.expectDownloadConfig();

			const command: string[] = [
				`os configure ${tmpImagePaths.intelNuc}`,
				'--device-type intel-nuc',
				'--fleet testApp',
				'--config-app-update-poll-interval 10',
				'--config-network ethernet',
				'--initial-device-name testDeviceNameIntelNuc',
				'--provisioning-key-name testKey',
				'--provisioning-key-expiry-date 2050-12-12',
			];

			const { err } = await runCommand(command.join(' '));
			expect(err.join('')).to.equal('');

			// confirm the image contains a config.json...
			const config = await imagefs.interact(
				tmpImagePaths.intelNuc,
				1,
				async (_fs) => {
					// confirm that there is no /os-release
					try {
						await _fs.promises.readFile('/os-release', {
							encoding: 'utf8',
						});
						throw new Error(
							'Found /os-release on the boot partition of an intel-nuc image, which is not expected to be there',
						);
					} catch (err) {
						const isFileNotFoundError =
							err instanceof Error &&
							'code' in err &&
							// fatfs throws errors with NOENT code, even though ENOENT is the standard
							// See: https://github.com/balena-io-modules/balena-image-fs/blob/v7.5.3/tests/e2e.ts#L300
							(err.code === 'ENOENT' || err.code === 'NOENT');
						if (!isFileNotFoundError) {
							throw err;
						}
						// reaching this point confirms that there is no /os-release in the boot partition
					}

					const dtJson = JSON.parse(
						await _fs.promises.readFile('/device-type.json', {
							encoding: 'utf8',
						}),
					);
					// confirm that the device-type.json mentions the expected partition
					expect(dtJson).to.have.nested.property(
						'configuration.config.partition.primary',
						1,
					);
					return await _fs.promises.readFile('/config.json');
				},
			);
			expect(config).to.not.be.empty;

			// confirm the image has the correct config.json values...
			const configObj = JSON.parse(config.toString('utf8'));
			expect(configObj).to.have.property('deviceType', 'intel-nuc');
			expect(configObj).to.have.property(
				'initialDeviceName',
				'testDeviceNameIntelNuc',
			);
		});

		it('should detect the OS version and inject a valid config.json file to an generic-amd64 (GPT) image', async () => {
			await api.expectGetApplication();
			await api.expectGetDeviceTypes();
			// It should not reach to /config or /device-types/v1 but instead find
			// everything required from the device-type.json in the image.
			await api.expectDownloadConfig();

			const command: string[] = [
				`os configure ${tmpImagePaths.genericAmd64}`,
				'--device-type generic-amd64',
				'--fleet testApp',
				'--config-app-update-poll-interval 10',
				'--config-network ethernet',
				'--initial-device-name testDeviceNameGenericAmd64',
				'--provisioning-key-name testKey',
				'--provisioning-key-expiry-date 2050-12-12',
			];

			const { err } = await runCommand(command.join(' '));
			expect(err.join('')).to.equal('');

			// confirm the image contains a config.json...
			const config = await imagefs.interact(
				tmpImagePaths.genericAmd64,
				1,
				async (_fs) => {
					// confirm that there is no /os-release
					try {
						await _fs.promises.readFile('/os-release', {
							encoding: 'utf8',
						});
						throw new Error(
							'Found /os-release on the boot partition of a generic-amd64 image, which is not expected to be there',
						);
					} catch (err) {
						const isFileNotFoundError =
							err instanceof Error &&
							'code' in err &&
							// fatfs throws errors with NOENT code, even though ENOENT is the standard
							// See: https://github.com/balena-io-modules/balena-image-fs/blob/v7.5.3/tests/e2e.ts#L300
							(err.code === 'ENOENT' || err.code === 'NOENT');
						if (!isFileNotFoundError) {
							throw err;
						}
						// reaching this point confirms that there is no /os-release in the boot partition
					}

					const dtJson = JSON.parse(
						await _fs.promises.readFile('/device-type.json', {
							encoding: 'utf8',
						}),
					);
					// confirm that the device-type.json mentions the expected partition
					expect(dtJson).to.have.nested.property(
						'configuration.config.partition.primary',
						1,
					);
					return await _fs.promises.readFile('/config.json');
				},
			);
			expect(config).to.not.be.empty;

			// confirm the image has the correct config.json values...
			const configObj = JSON.parse(config.toString('utf8'));
			expect(configObj).to.have.property('deviceType', 'generic-amd64');
			expect(configObj).to.have.property(
				'initialDeviceName',
				'testDeviceNameGenericAmd64',
			);
		});

		it('should fail when it can not detect the OS version of the provided image', async () => {
			await api.expectGetApplication();
			await api.expectGetDeviceTypes();

			const command: string[] = [
				`os configure ${tmpImagePaths.dummy}`,
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
					[warn] "${tmpImagePaths.dummy}":
					[warn]   Found partition table with 1 partitions,
					[warn]   but none with a name/label in ['resin-boot', 'flash-boot', 'balena-boot'].
					[warn]   Will scan all partitions for contents.
					[warn] "${tmpImagePaths.dummy}":
					[warn]   1 partition(s) found, but none containing file "/device-type.json".
					[warn]   Assuming default boot partition number '1'.
					[warn] "${tmpImagePaths.dummy}":
					[warn]   Could not find a previous "/config.json" file in partition '1'.
					[warn]   Proceeding anyway, but this is unexpected.
					Error while finding a device-type.json on the provided image path.`.split('\n'),
			);
		});

		it('should configure an image using --config with a config.json that has no networking setting without interactive questions', async () => {
			await api.expectGetApplication();
			await api.expectGetDeviceTypes();

			const configJson = {
				applicationId: 1301645,
				deviceType: 'generic-amd64',
				userId: 43699,
				appUpdatePollInterval: 600000,
				listenPort: 48484,
				vpnPort: 443,
				apiEndpoint: 'https://api.balena-cloud.com',
				vpnEndpoint: 'vpn.balena-cloud.com',
				registryEndpoint: 'registry2.balena-cloud.com',
				deltaEndpoint: 'https://delta.balena-cloud.com',
				apiKey: 'nothingtoseehere',
				initialDeviceName: `testDeviceNameGenericAmd64-${randomUUID()}`,
			};
			await using tmpDir = await fs.mkdtempDisposable(
				path.join(tmpdir(), 'os-configure-tests'),
			);
			const tmpPath = path.join(tmpDir.path, 'config.json');
			await fs.writeFile(tmpPath, JSON.stringify(configJson));

			const command: string[] = [
				`os configure ${tmpImagePaths.genericAmd64}`,
				`--config ${tmpPath}`,
			];

			const { err } = await runCommand(command.join(' '));
			expect(err.join('')).to.equal('');

			// confirm the image contains a config.json...
			const config = await imagefs.interact(
				tmpImagePaths.genericAmd64,
				1,
				async (_fs) => {
					return await _fs.promises.readFile('/config.json');
				},
			);
			expect(config).to.not.be.empty;

			const configObj = JSON.parse(config.toString('utf8'));
			expect(configObj).to.deep.equal({
				...configJson,
				files: {
					'network/network.config': [
						'[service_home_ethernet]',
						'Type=ethernet',
						'Nameservers=8.8.8.8,8.8.4.4',
					].join('\n'),
				},
			});
		});

		it('should configure an image using --config with a config.json that has wifi settings without interactive questions', async () => {
			await api.expectGetApplication();
			await api.expectGetDeviceTypes();

			const configJson = {
				applicationId: 1301645,
				deviceType: 'generic-amd64',
				userId: 43699,
				appUpdatePollInterval: 600000,
				listenPort: 48484,
				vpnPort: 443,
				apiEndpoint: 'https://api.balena-cloud.com',
				vpnEndpoint: 'vpn.balena-cloud.com',
				registryEndpoint: 'registry2.balena-cloud.com',
				deltaEndpoint: 'https://delta.balena-cloud.com',
				apiKey: 'nothingtoseehere',
				initialDeviceName: `testDeviceNameGenericAmd64-${randomUUID()}`,
				wifiSsid: `wifiSsid-${randomUUID()}`,
				wifiKey: `wifiKey-${randomUUID()}`,
			};
			await using tmpDir = await fs.mkdtempDisposable(
				path.join(tmpdir(), 'os-configure-tests'),
			);
			const tmpPath = path.join(tmpDir.path, 'config.json');
			await fs.writeFile(tmpPath, JSON.stringify(configJson));

			const command: string[] = [
				`os configure ${tmpImagePaths.genericAmd64}`,
				`--config ${tmpPath}`,
			];

			const { err } = await runCommand(command.join(' '));
			expect(err.join('')).to.equal('');

			// confirm the image contains a config.json...
			const config = await imagefs.interact(
				tmpImagePaths.genericAmd64,
				1,
				async (_fs) => {
					return await _fs.promises.readFile('/config.json');
				},
			);
			expect(config).to.not.be.empty;

			const configObj = JSON.parse(config.toString('utf8'));
			expect(configObj).to.deep.equal({
				...configJson,
				files: {
					'network/network.config': [
						'[service_home_ethernet]',
						'Type=ethernet',
						'Nameservers=8.8.8.8,8.8.4.4',
						'',
						'[service_home_wifi]',
						'Hidden=true',
						'Type=wifi',
						`Name=${configJson.wifiSsid}`,
						`Passphrase=${configJson.wifiKey}`,
						'Nameservers=8.8.8.8,8.8.4.4',
					].join('\n'),
				},
			});
		});

		it('should fail when providing --config config.json with an invalid installer.secureboot value', async () => {
			const configJson = {
				applicationId: 1301645,
				deviceType: 'generic-amd64',
				userId: 43699,
				appUpdatePollInterval: 600000,
				listenPort: 48484,
				vpnPort: 443,
				apiEndpoint: 'https://api.balena-cloud.com',
				vpnEndpoint: 'vpn.balena-cloud.com',
				registryEndpoint: 'registry2.balena-cloud.com',
				deltaEndpoint: 'https://delta.balena-cloud.com',
				apiKey: 'nothingtoseehere',
				installer: {
					secureboot: 'true',
				},
			};
			await using tmpDir = await fs.mkdtempDisposable(
				path.join(tmpdir(), 'os-configure-tests'),
			);
			const tmpPath = path.join(tmpDir.path, 'config.json');
			await fs.writeFile(tmpPath, JSON.stringify(configJson));

			const command: string[] = [
				`os configure ${tmpImagePaths.genericAmd64}`,
				`--config ${tmpPath}`,
			];

			const { err } = await runCommand(command.join(' '));
			expect(err.join('').replaceAll('\n', '')).to.equal(
				`Invalid installer.secureboot in config.json: value must be a boolean, found string: 'true'`,
			);
		});

		it('should be able to configure a secureboot generic-amd64 image with just the --config config.json parameter', async () => {
			await api.expectGetDeviceTypes();
			await api.expectGetApplication();
			// Register this AFTER expectGetApplication since mockttp uses "last match wins"
			// and this mock has a more specific matching condition for is_host requests
			await api.expectGetContractOfOsRelease({
				deviceTypeSlug: 'generic-amd64',
				rawVersion: '6.8.1',
			});

			const configJson = {
				applicationId: 1301645,
				deviceType: 'generic-amd64',
				userId: 43699,
				appUpdatePollInterval: 600000,
				listenPort: 48484,
				vpnPort: 443,
				apiEndpoint: 'https://api.balena-cloud.com',
				vpnEndpoint: 'vpn.balena-cloud.com',
				registryEndpoint: 'registry2.balena-cloud.com',
				deltaEndpoint: 'https://delta.balena-cloud.com',
				apiKey: 'nothingtoseehere',
				initialDeviceName: `testDeviceNameGenericAmd64-${randomUUID()}`,
				installer: {
					secureboot: true,
				},
			};
			await using tmpDir = await fs.mkdtempDisposable(
				path.join(tmpdir(), 'os-configure-tests'),
			);
			const tmpPath = path.join(tmpDir.path, 'config.json');
			await fs.writeFile(tmpPath, JSON.stringify(configJson));

			const command: string[] = [
				`os configure ${tmpImagePaths.genericAmd64}`,
				`--config ${tmpPath}`,
			];

			const { err } = await runCommand(command.join(' '));
			expect(err.join('')).to.equal('');

			// confirm the image contains a config.json...
			const config = await imagefs.interact(
				tmpImagePaths.genericAmd64,
				1,
				async (_fs) => {
					return await _fs.promises.readFile('/config.json');
				},
			);
			expect(config).to.not.be.empty;

			const configObj = JSON.parse(config.toString('utf8'));
			expect(configObj).to.deep.equal({
				...configJson,
				files: {
					'network/network.config': [
						'[service_home_ethernet]',
						'Type=ethernet',
						'Nameservers=8.8.8.8,8.8.4.4',
					].join('\n'),
				},
			});
			expect(configObj).to.have.nested.property('installer.secureboot', true);
		});
	});
}
