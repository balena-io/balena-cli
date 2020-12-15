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

import { flags } from '@oclif/command';
import Command from '../../command';
import * as cf from '../../utils/common-flags';
import { getBalenaSdk, stripIndent } from '../../utils/lazy';
import { applicationIdInfo } from '../../utils/messages';
import { runCommand } from '../../utils/helpers';

interface FlagsDef {
	application?: string;
	app?: string;
	yes: boolean;
	advanced: boolean;
	'os-version'?: string;
	drive?: string;
	config?: string;
	help: void;
}

export default class DeviceInitCmd extends Command {
	public static description = stripIndent`
		Initialize a device with balenaOS.

		Initialize a device by downloading the OS image of a certain application
		and writing it to an SD Card.

		Note, if the application option is omitted it will be prompted
		for interactively.

		${applicationIdInfo.split('\n').join('\n\t\t')}
	`;

	public static examples = [
		'$ balena device init',
		'$ balena device init --application MyApp',
		'$ balena device init -a myorg/myapp',
	];

	public static usage = 'device init';

	public static flags: flags.Input<FlagsDef> = {
		application: cf.application,
		app: cf.app,
		yes: cf.yes,
		advanced: flags.boolean({
			char: 'v',
			description: 'show advanced configuration options',
		}),
		'os-version': flags.string({
			description: stripIndent`
				exact version number, or a valid semver range,
				or 'latest' (includes pre-releases),
				or 'default' (excludes pre-releases if at least one stable version is available),
				or 'recommended' (excludes pre-releases, will fail if only pre-release versions are available),
				or 'menu' (will show the interactive menu)
				`,
		}),
		drive: cf.drive,
		config: flags.string({
			description: 'path to the config JSON file, see `balena os build-config`',
		}),
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { flags: options } = this.parse<FlagsDef, {}>(DeviceInitCmd);

		// Imports
		const { promisify } = await import('util');
		const rimraf = promisify(await import('rimraf'));
		const tmp = await import('tmp');
		const tmpNameAsync = promisify(tmp.tmpName);
		tmp.setGracefulCleanup();
		const { downloadOSImage } = await import('../../utils/cloud');
		const { getApplication } = await import('../../utils/sdk');

		const logger = await Command.getLogger();
		const balena = getBalenaSdk();

		// Consolidate application options
		options.application = options.application || options.app;
		delete options.app;

		// Get application and
		const application = (await getApplication(
			balena,
			options['application'] ||
				(await (await import('../../utils/patterns')).selectApplication()).id,
			{
				$expand: {
					is_for__device_type: {
						$select: 'slug',
					},
				},
			},
		)) as ApplicationWithDeviceType;

		// Register new device
		const deviceUuid = balena.models.device.generateUniqueKey();
		console.info(`Registering to ${application.app_name}: ${deviceUuid}`);
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
