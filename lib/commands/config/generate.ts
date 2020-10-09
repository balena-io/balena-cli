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
import { getBalenaSdk, getCliForm, stripIndent } from '../../utils/lazy';
import type { Application, PineDeferred } from 'balena-sdk';

interface FlagsDef {
	version: string; // OS version
	application?: string;
	app?: string; // application alias
	device?: string;
	deviceApiKey?: string;
	deviceType?: string;
	'generate-device-api-key': boolean;
	output?: string;
	// Options for non-interactive configuration
	network?: string;
	wifiSsid?: string;
	wifiKey?: string;
	appUpdatePollInterval?: string;
	help: void;
}

export default class ConfigGenerateCmd extends Command {
	public static description = stripIndent`
		Generate a config.json file.

		Generate a config.json file for a device or application.

		Calling this command with the exact version number of the targeted image is required.

		This command is interactive by default, but you can do this automatically without interactivity
		by specifying an option for each question on the command line, if you know the questions
		that will be asked for the relevant device type.

		In case that you want to configure an image for an application with mixed device types,
		you can pass the --device-type argument along with --app to specify the target device type.
	`;

	public static examples = [
		'$ balena config generate --device 7cf02a6 --version 2.12.7',
		'$ balena config generate --device 7cf02a6 --version 2.12.7 --generate-device-api-key',
		'$ balena config generate --device 7cf02a6 --version 2.12.7 --device-api-key <existingDeviceKey>',
		'$ balena config generate --device 7cf02a6 --version 2.12.7 --output config.json',
		'$ balena config generate --app MyApp --version 2.12.7',
		'$ balena config generate --app MyApp --version 2.12.7 --device-type fincm3',
		'$ balena config generate --app MyApp --version 2.12.7 --output config.json',
		'$ balena config generate --app MyApp --version 2.12.7 --network wifi --wifiSsid mySsid --wifiKey abcdefgh --appUpdatePollInterval 1',
	];

	public static flags: flags.Input<FlagsDef> = {
		version: flags.string({
			description: 'a balenaOS version',
			required: true,
		}),
		application: flags.string({
			description: 'application name',
			char: 'a',
			exclusive: ['app', 'device'],
		}),
		app: flags.string({
			description: "same as '--application'",
			exclusive: ['application', 'device'],
		}),
		device: flags.string({
			description: 'device uuid',
			char: 'd',
			exclusive: ['application', 'app'],
		}),
		deviceApiKey: flags.string({
			description:
				'custom device key - note that this is only supported on balenaOS 2.0.3+',
			char: 'k',
		}),
		deviceType: flags.string({
			description: 'device type slug',
		}),
		'generate-device-api-key': flags.boolean({
			description: 'generate a fresh device key for the device',
		}),
		output: flags.string({
			description: 'path of output file',
			char: 'o',
		}),
		// Options for non-interactive configuration
		network: flags.string({
			description: 'the network type to use: ethernet or wifi',
			options: ['ethernet', 'wifi'],
		}),
		wifiSsid: flags.string({
			description:
				'the wifi ssid to use (used only if --network is set to wifi)',
		}),
		wifiKey: flags.string({
			description:
				'the wifi key to use (used only if --network is set to wifi)',
		}),
		appUpdatePollInterval: flags.string({
			description:
				'how frequently (in minutes) to poll for application updates',
		}),
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { flags: options } = this.parse<FlagsDef, {}>(ConfigGenerateCmd);

		const balena = getBalenaSdk();

		await this.validateOptions(options);

		let deviceType = options.deviceType;
		// Get device | application
		let resource;
		if (options.device != null) {
			const { tryAsInteger } = await import('../../utils/validation');
			resource = (await balena.models.device.get(tryAsInteger(options.device), {
				$expand: {
					is_of__device_type: { $select: 'slug' },
				},
			})) as DeviceWithDeviceType & { belongs_to__application: PineDeferred };
			deviceType = deviceType || resource.is_of__device_type[0].slug;
		} else {
			resource = (await balena.models.application.get(options.application!, {
				$expand: {
					is_for__device_type: { $select: 'slug' },
				},
			})) as ApplicationWithDeviceType;
			deviceType = deviceType || resource.is_for__device_type[0].slug;
		}

		const deviceManifest = await balena.models.device.getManifestBySlug(
			deviceType!,
		);

		// Check compatibility if application and deviceType provided
		if (options.application && options.deviceType) {
			const appDeviceManifest = await balena.models.device.getManifestBySlug(
				deviceType!,
			);

			const helpers = await import('../../utils/helpers');
			if (
				!helpers.areDeviceTypesCompatible(appDeviceManifest, deviceManifest)
			) {
				throw new balena.errors.BalenaInvalidDeviceType(
					`Device type ${options.deviceType} is incompatible with application ${options.application}`,
				);
			}
		}

		// Prompt for values
		// Pass params as an override: if there is any param with exactly the same name as a
		// required option, that value is used (and the corresponding question is not asked)
		const answers = await getCliForm().run(deviceManifest.options, {
			override: options,
		});
		answers.version = options.version;

		// Generate config
		const { generateDeviceConfig, generateApplicationConfig } = await import(
			'../../utils/config'
		);

		let config;
		if ('uuid' in resource && resource.uuid != null) {
			config = await generateDeviceConfig(
				resource,
				options.deviceApiKey || options['generate-device-api-key'] || undefined,
				answers,
			);
		} else {
			answers.deviceType = deviceType;
			config = await generateApplicationConfig(
				resource as Application,
				answers,
			);
		}

		// Output
		if (options.output != null) {
			const fs = await import('fs');
			await fs.promises.writeFile(options.output, JSON.stringify(config));
		}

		const prettyjson = await import('prettyjson');
		console.log(prettyjson.render(config));
	}

	protected readonly missingDeviceOrAppMessage = stripIndent`
		Either a device or an application must be specified.

		See the help page for examples:

		  $ balena help config generate
  	`;

	protected readonly deviceTypeNotAllowedMessage = stripIndent`
		Specifying a different device type is only supported when
		generating a config for an application:

		* An application, with --app <appname>
		* A specific device type, with --device-type <deviceTypeSlug>

		See the help page for examples:

		  $ balena help config generate
	`;

	protected async validateOptions(options: FlagsDef) {
		const { ExpectedError } = await import('../../errors');

		// Prefer options.application over options.app
		options.application = options.application || options.app;
		delete options.app;

		if (options.device == null && options.application == null) {
			throw new ExpectedError(this.missingDeviceOrAppMessage);
		}

		if (!options.application && options.deviceType) {
			throw new ExpectedError(this.deviceTypeNotAllowedMessage);
		}
	}
}
