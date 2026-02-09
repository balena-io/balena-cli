/**
 * @license
 * Copyright 2016-2020 Balena Ltd.
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

import { Flags, Command } from '@oclif/core';
import * as cf from '../../utils/common-flags';
import { getBalenaSdk, stripIndent } from '../../utils/lazy';
import { applicationIdInfo } from '../../utils/messages';
import { runCommand } from '../../utils/helpers';
import type { ImgConfig } from '../../utils/config';

async function validateArgsAndOptions(options: FlagsDef) {
	// 'application' & 'config` options are declared "exclusive" in the oclif
	// flag definitions above, so oclif will enforce that they are not used together.
	if (!options.fleet && !options.config) {
		const { ExpectedError } = await import('../../errors');
		throw new ExpectedError(
			"Either the '--fleet' or the '--config' option must be provided",
		);
	}

	const { validateFilePath } = await import('../../utils/validation');

	if (options.config != null) {
		await validateFilePath(options.config);
	}
}

interface FlagsDef {
	fleet?: string;
	yes: boolean;
	advanced: boolean;
	'os-version'?: string;
	drive?: string;
	config?: string;
	'provisioning-key-name'?: string;
	'provisioning-key-expiry-date'?: string;
}

export default class DeviceInitCmd extends Command {
	public static description = stripIndent`
		Initialize a device with balenaOS.

		Register a new device in the selected fleet, download the OS image for the
		fleet's default device type, configure the image and write it to an SD card.
		This command effectively combines several other balena CLI commands in one,
		namely:

		'balena device register'
		'balena os download'
		'balena config generate'
		'balena os configure'
		'balena os local flash'

		Possible arguments for the '--fleet', '--os-version' and '--drive' options can
		be listed respectively with the commands:

		'balena fleet list'
		'balena os versions'
		'balena util available-drives'

		If the '--fleet' or '--drive' options are omitted, interactive menus will be
		presented with values to choose from. If the '--os-version' option is omitted,
		the latest released OS version for the fleet's default device type will be used.

		${applicationIdInfo.split('\n').join('\n\t\t')}

		Image configuration questions will be asked interactively unless a pre-configured
		'config.json' file is provided with the '--config' option.  The file can be
		generated with the 'balena config generate' command.
	`;

	public static examples = [
		'$ balena device init',
		'$ balena device init -f myorg/myfleet',
		'$ balena device init --fleet myFleet --os-version 2.101.7 --drive /dev/disk5',
		'$ balena device init --fleet myFleet --os-version 2.83.21+rev1.prod --drive /dev/disk5',
		'$ balena device init --config config.json --os-version 2.101.7 --drive /dev/disk5 --yes',
	];

	public static flags = (() => {
		const inlineConfiFlags = {
			advanced: Flags.boolean({
				char: 'v',
				description: 'show advanced configuration options',
			}),
			'provisioning-key-name': Flags.string({
				description:
					'custom key name assigned to generated provisioning api key',
			}),
			'provisioning-key-expiry-date': Flags.string({
				description:
					'expiry date assigned to generated provisioning api key (format: YYYY-MM-DD)',
			}),
		};
		return {
			fleet: cf.fleet({ exclusive: ['config'] }),
			config: Flags.string({
				description:
					'path to the config JSON file, see `balena config generate`',
				exclusive: ['fleet', ...Object.keys(inlineConfiFlags)],
			}),
			'os-version': Flags.string({
				description: stripIndent`
					exact version number, or a valid semver range,
					or 'latest' (exludes invalidated & pre-releases),
					or 'menu' (will show the interactive menu)
					`,
			}),
			...inlineConfiFlags,
			drive: cf.drive(),
			yes: cf.yes(),
		};
	})();

	public static authenticated = true;

	public async run() {
		const { flags: options } = await this.parse(DeviceInitCmd);
		await validateArgsAndOptions(options);

		// Imports
		const { promisify } = await import('util');
		const { promises: fs } = await import('node:fs');
		const tmp = await import('tmp');
		const tmpNameAsync = promisify(tmp.tmpName);
		tmp.setGracefulCleanup();
		const { downloadOSImage } = await import('../../utils/cloud');
		const { getApplication } = await import('../../utils/sdk');
		const Logger = await import('../../utils/logger');

		const logger = Logger.getLogger();
		const balena = getBalenaSdk();

		let fleetSlugOrId: string | number | undefined = options.fleet;
		let configJson: ImgConfig | undefined;
		if (options.config != null) {
			const { readAndValidateConfigJson } = await import('../../utils/config');
			configJson = await readAndValidateConfigJson(options.config);
			fleetSlugOrId = configJson.applicationId;
		}

		// Get application and
		const application = fleetSlugOrId
			? await getApplication(balena, fleetSlugOrId, {
					$select: ['id', 'slug'],
					$expand: {
						is_for__device_type: {
							$select: 'slug',
						},
					},
				})
			: await (await import('../../utils/patterns')).selectApplication();

		// Register new device
		const deviceUuid = balena.models.device.generateUniqueKey();
		console.info(`Registering to ${application.slug}: ${deviceUuid}`);
		const device = await balena.models.device.register(
			application.id,
			deviceUuid,
		);

		// Download OS, configure, and flash
		const tmpPath = (await tmpNameAsync()) as string;
		try {
			logger.logDebug(`Downloading OS image...`);
			const osVersion = options['os-version'] ?? 'latest';
			const deviceType =
				configJson?.deviceType ?? application.is_for__device_type[0].slug;
			await downloadOSImage(deviceType, tmpPath, osVersion);

			logger.logDebug(`Configuring OS image...`);
			await this.configureOsImage(tmpPath, device, options, configJson, logger);

			logger.logDebug(`Writing OS image...`);
			await this.writeOsImage(tmpPath, deviceType, options);
		} catch (e) {
			// Remove device in failed cases
			try {
				logger.logDebug(`Process failed, removing device ${device.uuid}`);
				await balena.models.device.remove(device.uuid);
			} catch {
				// Ignore removal failures, and throw original error
			}
			throw e;
		} finally {
			// Remove temp download
			logger.logDebug(`Removing temporary OS image download...`);
			await fs.rm(tmpPath, { recursive: true, force: true });
		}

		console.log('Done');
		return device.uuid;
	}

	async configureOsImage(
		osImagePath: string,
		device: { id: number; uuid: string; api_key: string },
		options: FlagsDef,
		configJson: ImgConfig | undefined,
		logger: import('../../utils/logger'),
	) {
		let tmpConfigJsonPath: string | undefined;
		const { promises: fs } = await import('node:fs');

		try {
			const configureCommand = ['os', 'configure', osImagePath];
			if (configJson != null) {
				// Since `os configure` doesn't allow mixing --config with other parameters
				// when the user has provided a config.json, we need to create a temp clone,
				// augment it withe extra parameters (like device & api key), and pass that
				// to `os configure` via --config
				const { populateDeviceConfig } = await import('../../utils/config');
				populateDeviceConfig(configJson, device, device.api_key);

				const tmp = await import('tmp');
				const { promisify } = await import('util');
				const tmpNameAsync = promisify(tmp.tmpName);
				tmp.setGracefulCleanup();

				tmpConfigJsonPath = (await tmpNameAsync()) as string;
				const fs = await import('fs/promises');
				await fs.writeFile(tmpConfigJsonPath, JSON.stringify(configJson));

				configureCommand.push('--config', tmpConfigJsonPath);
			} else {
				configureCommand.push('--device', device.uuid);

				if (options.advanced) {
					configureCommand.push('--advanced');
				}

				if (options['provisioning-key-name']) {
					configureCommand.push(
						'--provisioning-key-name',
						options['provisioning-key-name'],
					);
				}

				if (options['provisioning-key-expiry-date']) {
					configureCommand.push(
						'--provisioning-key-expiry-date',
						options['provisioning-key-expiry-date'],
					);
				}
			}

			await runCommand(configureCommand);
		} finally {
			if (tmpConfigJsonPath != null) {
				// Remove temp config.json
				logger.logDebug(`Removing temporary config.json...`);
				await fs.rm(tmpConfigJsonPath, { recursive: true, force: true });
			}
		}
	}

	async writeOsImage(path: string, deviceType: string, options: FlagsDef) {
		const osInitCommand = ['os', 'initialize', path, '--type', deviceType];
		if (options.yes) {
			osInitCommand.push('--yes');
		}
		if (options.drive) {
			osInitCommand.push('--drive', options.drive);
		}
		await runCommand(osInitCommand);
	}
}
