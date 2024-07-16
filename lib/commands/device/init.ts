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

import { Flags } from '@oclif/core';
import Command from '../../command.js';
import * as cf from '../../utils/common-flags.js';
import { getBalenaSdk, stripIndent } from '../../utils/lazy.js';
import { applicationIdInfo } from '../../utils/messages.js';
import { runCommand } from '../../utils/helpers.js';

interface FlagsDef {
	fleet?: string;
	yes: boolean;
	advanced: boolean;
	'os-version'?: string;
	drive?: string;
	config?: string;
	help: void;
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
		'balena os build-config' or 'balena config generate'  
		'balena os configure'  
		'balena os local flash'

		Possible arguments for the '--fleet', '--os-version' and '--drive' options can
		be listed respectively with the commands:

		'balena fleets'  
		'balena os versions'  
		'balena util available-drives'

		If the '--fleet' or '--drive' options are omitted, interactive menus will be
		presented with values to choose from. If the '--os-version' option is omitted,
		the latest released OS version for the fleet's default device type will be used.

		${applicationIdInfo.split('\n').join('\n\t\t')}

		Image configuration questions will be asked interactively unless a pre-configured
		'config.json' file is provided with the '--config' option.  The file can be
		generated with the 'balena config generate' or 'balena os build-config' commands.
	`;

	public static examples = [
		'$ balena device init',
		'$ balena device init -f myorg/myfleet',
		'$ balena device init --fleet myFleet --os-version 2.101.7 --drive /dev/disk5 --config config.json --yes',
		'$ balena device init --fleet myFleet --os-version 2.83.21+rev1.prod --drive /dev/disk5 --config config.json --yes',
	];

	public static usage = 'device init';

	public static flags = {
		fleet: cf.fleet,
		yes: cf.yes,
		advanced: Flags.boolean({
			char: 'v',
			description: 'show advanced configuration options',
		}),
		'os-version': Flags.string({
			description: stripIndent`
				exact version number, or a valid semver range,
				or 'latest' (includes pre-releases),
				or 'default' (excludes pre-releases if at least one stable version is available),
				or 'recommended' (excludes pre-releases, will fail if only pre-release versions are available),
				or 'menu' (will show the interactive menu)
				`,
		}),
		drive: cf.drive,
		config: Flags.string({
			description: 'path to the config JSON file, see `balena os build-config`',
		}),
		'provisioning-key-name': Flags.string({
			description: 'custom key name assigned to generated provisioning api key',
		}),
		'provisioning-key-expiry-date': Flags.string({
			description:
				'expiry date assigned to generated provisioning api key (format: YYYY-MM-DD)',
		}),
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { flags: options } = await this.parse(DeviceInitCmd);

		// Imports
		const { promisify } = await import('util');
		const rimraf = promisify((await import('rimraf')).default);
		const tmp = await import('tmp');
		const tmpNameAsync = promisify(tmp.tmpName);
		tmp.setGracefulCleanup();
		const { downloadOSImage } = await import('../../utils/cloud.js');
		const { getApplication } = await import('../../utils/sdk.js');

		const logger = await Command.getLogger();
		const balena = getBalenaSdk();

		// Get application and
		const application = options.fleet
			? await getApplication(balena, options.fleet, {
					$select: ['id', 'slug'],
					$expand: {
						is_for__device_type: {
							$select: 'slug',
						},
					},
				})
			: await (await import('../../utils/patterns.js')).selectApplication();

		// Register new device
		const deviceUuid = balena.models.device.generateUniqueKey();
		console.info(`Registering to ${application.slug}: ${deviceUuid}`);
		await balena.models.device.register(application.id, deviceUuid);
		const device = await balena.models.device.get(deviceUuid);

		// Download OS, configure, and flash
		const tmpPath = (await tmpNameAsync()) as string;
		try {
			logger.logDebug(`Downloading OS image...`);
			const osVersion = options['os-version'] || 'default';
			const deviceType = application.is_for__device_type[0].slug;
			await downloadOSImage(deviceType, tmpPath, osVersion);

			logger.logDebug(`Configuring OS image...`);
			await this.configureOsImage(tmpPath, device.uuid, options);

			logger.logDebug(`Writing OS image...`);
			await this.writeOsImage(tmpPath, deviceType, options);
		} catch (e) {
			// Remove device in failed cases
			try {
				logger.logDebug(`Process failed, removing device ${device.uuid}`);
				await balena.models.device.remove(device.uuid);
			} catch (e) {
				// Ignore removal failures, and throw original error
			}
			throw e;
		} finally {
			// Remove temp download
			logger.logDebug(`Removing temporary OS image download...`);
			await rimraf(tmpPath);
		}

		console.log('Done');
		return device.uuid;
	}

	async configureOsImage(path: string, uuid: string, options: FlagsDef) {
		const configureCommand = ['os', 'configure', path, '--device', uuid];
		if (options.config) {
			configureCommand.push('--config', options.config);
		} else if (options.advanced) {
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

		await runCommand(configureCommand);
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
