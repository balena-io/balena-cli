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
import type { Interfaces } from '@oclif/core';
import Command from '../../command.js';
import * as cf from '../../utils/common-flags.js';
import { getBalenaSdk, getCliForm, stripIndent } from '../../utils/lazy.js';
import {
	applicationIdInfo,
	devModeInfo,
	secureBootInfo,
} from '../../utils/messages.js';
import type { BalenaSDK, PineDeferred } from 'balena-sdk';

export default class ConfigGenerateCmd extends Command {
	public static description = stripIndent`
		Generate a config.json file.

		Generate a config.json file for a device or fleet.

		The target balenaOS version must be specified with the --version option.

		${devModeInfo.split('\n').join('\n\t\t')}

		${secureBootInfo.split('\n').join('\n\t\t')}

		To configure an image for a fleet of mixed device types, use the --fleet option
		alongside the --deviceType option to specify the target device type.

		To avoid interactive questions, specify a command line option for each question that
		would otherwise be asked.

		${applicationIdInfo.split('\n').join('\n\t\t')}
	`;

	public static examples = [
		'$ balena config generate --device 7cf02a6 --version 2.12.7',
		'$ balena config generate --device 7cf02a6 --version 2.12.7 --generate-device-api-key',
		'$ balena config generate --device 7cf02a6 --version 2.12.7 --deviceApiKey <existingDeviceKey>',
		'$ balena config generate --device 7cf02a6 --version 2.12.7 --output config.json',
		'$ balena config generate --fleet myorg/fleet --version 2.12.7 --dev',
		'$ balena config generate --fleet myorg/fleet --version 2.12.7 --secureBoot',
		'$ balena config generate --fleet myorg/fleet --version 2.12.7 --deviceType fincm3',
		'$ balena config generate --fleet myorg/fleet --version 2.12.7 --output config.json',
		'$ balena config generate --fleet myorg/fleet --version 2.12.7 --network wifi --wifiSsid mySsid --wifiKey abcdefgh --appUpdatePollInterval 15',
	];

	public static usage = 'config generate';

	public static flags = {
		version: Flags.string({
			description: 'a balenaOS version',
			required: true,
		}),
		fleet: { ...cf.fleet, exclusive: ['device'] },
		dev: cf.dev,
		secureBoot: cf.secureBoot,
		device: {
			...cf.device,
			exclusive: [
				'fleet',
				'provisioning-key-name',
				'provisioning-key-expiry-date',
			],
		},
		deviceApiKey: Flags.string({
			description:
				'custom device key - note that this is only supported on balenaOS 2.0.3+',
			char: 'k',
		}),
		deviceType: Flags.string({
			description:
				"device type slug (run 'balena devices supported' for possible values)",
		}),
		'generate-device-api-key': Flags.boolean({
			description: 'generate a fresh device key for the device',
		}),
		output: Flags.string({
			description: 'path of output file',
			char: 'o',
		}),
		// Options for non-interactive configuration
		network: Flags.string({
			description: 'the network type to use: ethernet or wifi',
			options: ['ethernet', 'wifi'],
		}),
		wifiSsid: Flags.string({
			description:
				'the wifi ssid to use (used only if --network is set to wifi)',
		}),
		wifiKey: Flags.string({
			description:
				'the wifi key to use (used only if --network is set to wifi)',
		}),
		appUpdatePollInterval: Flags.string({
			description:
				'supervisor cloud polling interval in minutes (e.g. for device variables)',
		}),
		'provisioning-key-name': Flags.string({
			description: 'custom key name assigned to generated provisioning api key',
			exclusive: ['device'],
		}),
		'provisioning-key-expiry-date': Flags.string({
			description:
				'expiry date assigned to generated provisioning api key (format: YYYY-MM-DD)',
			exclusive: ['device'],
		}),
		help: cf.help,
	};

	public static authenticated = true;

	public async getApplication(balena: BalenaSDK, fleet: string) {
		const { getApplication } = await import('../../utils/sdk.js');
		return await getApplication(balena, fleet, {
			$select: 'slug',
			$expand: {
				is_for__device_type: { $select: 'slug' },
			},
		});
	}

	public async run() {
		const { flags: options } = await this.parse(ConfigGenerateCmd);
		const balena = getBalenaSdk();

		await this.validateOptions(options);

		let resourceDeviceType: string;
		let application: Awaited<ReturnType<typeof this.getApplication>> | null =
			null;
		let device:
			| (DeviceWithDeviceType & { belongs_to__application: PineDeferred })
			| null = null;
		if (options.device != null) {
			const rawDevice = await balena.models.device.get(options.device, {
				$expand: { is_of__device_type: { $select: 'slug' } },
			});
			if (!rawDevice.belongs_to__application) {
				const { ExpectedError } = await import('../../errors.js');
				throw new ExpectedError(stripIndent`
					Device ${options.device} does not appear to belong to an accessible fleet.
					Try with a different device, or use '--fleet' instead of '--device'.`);
			}
			device = rawDevice as DeviceWithDeviceType & {
				belongs_to__application: PineDeferred;
			};
			resourceDeviceType = device.is_of__device_type[0].slug;
		} else {
			// Disambiguate application (if is a number, it could either be an ID or a numerical name)
			application = await this.getApplication(balena, options.fleet!);
			resourceDeviceType = application.is_for__device_type[0].slug;
		}

		const deviceType = options.deviceType || resourceDeviceType;

		// Check compatibility if application and deviceType provided
		if (options.fleet && options.deviceType) {
			const helpers = await import('../../utils/helpers.js');
			if (
				!(await helpers.areDeviceTypesCompatible(
					resourceDeviceType,
					deviceType,
				))
			) {
				const { ExpectedError } = await import('../../errors.js');
				throw new ExpectedError(
					`Device type ${options.deviceType} is incompatible with fleet ${options.fleet}`,
				);
			}
		}

		const deviceManifest =
			await balena.models.config.getDeviceTypeManifestBySlug(deviceType);

		const { validateSecureBootOptionAndWarn } = await import(
			'../../utils/config.js'
		);
		await validateSecureBootOptionAndWarn(
			options.secureBoot,
			deviceType,
			options.version,
		);

		// Prompt for values
		// Pass params as an override: if there is any param with exactly the same name as a
		// required option, that value is used (and the corresponding question is not asked)
		const answers = await getCliForm().run(deviceManifest.options, {
			override: { ...options, app: options.fleet, application: options.fleet },
		});
		answers.version = options.version;
		answers.developmentMode = options.dev;
		answers.secureBoot = options.secureBoot;
		answers.provisioningKeyName = options['provisioning-key-name'];
		answers.provisioningKeyExpiryDate = options['provisioning-key-expiry-date'];

		// Generate config
		const { generateDeviceConfig, generateApplicationConfig } = await import(
			'../../utils/config.js'
		);

		let config;
		if (device) {
			config = await generateDeviceConfig(
				device,
				options.deviceApiKey || options['generate-device-api-key'] || undefined,
				answers,
			);
		} else if (application) {
			answers.deviceType = deviceType;
			config = await generateApplicationConfig(application, answers);
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
		Either a device or a fleet must be specified.

		See the help page for examples:

		  $ balena help config generate
  	`;

	protected readonly deviceTypeNotAllowedMessage =
		'The --deviceType option can only be used alongside the --fleet option';

	protected async validateOptions(
		options: Interfaces.InferredFlags<typeof ConfigGenerateCmd.flags>,
	) {
		const { ExpectedError } = await import('../../errors.js');

		if (options.device == null && options.fleet == null) {
			throw new ExpectedError(this.missingDeviceOrAppMessage);
		}

		if (!options.fleet && options.deviceType) {
			throw new ExpectedError(this.deviceTypeNotAllowedMessage);
		}
		const { normalizeOsVersion } = await import('../../utils/normalization.js');
		options.version = normalizeOsVersion(options.version);
		const { validateDevOptionAndWarn } = await import('../../utils/config.js');
		await validateDevOptionAndWarn(options.dev, options.version);
	}
}
