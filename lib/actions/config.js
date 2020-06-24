/*
Copyright 2016-2020 Balena Ltd.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import * as commandOptions from './command-options';

import { normalizeUuidProp } from '../utils/normalization';
import { getBalenaSdk, getVisuals } from '../utils/lazy';

export const read = {
	signature: 'config read',
	description: 'read a device configuration',
	help: `\
Use this command to read the config.json file from the mounted filesystem (e.g. SD card) of a provisioned device"

Examples:

	$ balena config read --type raspberry-pi
	$ balena config read --type raspberry-pi --drive /dev/disk2\
`,
	options: [
		{
			signature: 'type',
			description:
				'device type (Check available types with `balena devices supported`)',
			parameter: 'type',
			alias: 't',
			required: 'You have to specify a device type',
		},
		{
			signature: 'drive',
			description: 'drive',
			parameter: 'drive',
			alias: 'd',
		},
	],
	permission: 'user',
	root: true,
	action(_params, options) {
		const Bluebird = require('bluebird');
		const config = require('balena-config-json');
		const umountAsync = Bluebird.promisify(require('umount').umount);
		const prettyjson = require('prettyjson');

		return Bluebird.try(
			() => options.drive || getVisuals().drive('Select the device drive'),
		)
			.tap(umountAsync)
			.then((drive) => config.read(drive, options.type))
			.tap((configJSON) => {
				console.info(prettyjson.render(configJSON));
			});
	},
};

export const write = {
	signature: 'config write <key> <value>',
	description: 'write a device configuration',
	help: `\
Use this command to write the config.json file to the mounted filesystem (e.g. SD card) of a provisioned device

Examples:

	$ balena config write --type raspberry-pi username johndoe
	$ balena config write --type raspberry-pi --drive /dev/disk2 username johndoe
	$ balena config write --type raspberry-pi files.network/settings "..."\
`,
	options: [
		{
			signature: 'type',
			description:
				'device type (Check available types with `balena devices supported`)',
			parameter: 'type',
			alias: 't',
			required: 'You have to specify a device type',
		},
		{
			signature: 'drive',
			description: 'drive',
			parameter: 'drive',
			alias: 'd',
		},
	],
	permission: 'user',
	root: true,
	action(params, options) {
		const Bluebird = require('bluebird');
		const _ = require('lodash');
		const config = require('balena-config-json');
		const umountAsync = Bluebird.promisify(require('umount').umount);

		return Bluebird.try(
			() => options.drive || getVisuals().drive('Select the device drive'),
		)
			.tap(umountAsync)
			.then((drive) =>
				config
					.read(drive, options.type)
					.then(function (configJSON) {
						console.info(`Setting ${params.key} to ${params.value}`);
						_.set(configJSON, params.key, params.value);
						return configJSON;
					})
					.tap(() => umountAsync(drive))
					.then((configJSON) => config.write(drive, options.type, configJSON)),
			)
			.tap(() => {
				console.info('Done');
			});
	},
};

export const inject = {
	signature: 'config inject <file>',
	description: 'inject a device configuration file',
	help: `\
Use this command to inject a config.json file to the mounted filesystem
(e.g. SD card or mounted balenaOS image) of a provisioned device"

Examples:

	$ balena config inject my/config.json --type raspberry-pi
	$ balena config inject my/config.json --type raspberry-pi --drive /dev/disk2\
`,
	options: [
		{
			signature: 'type',
			description:
				'device type (Check available types with `balena devices supported`)',
			parameter: 'type',
			alias: 't',
			required: 'You have to specify a device type',
		},
		{
			signature: 'drive',
			description: 'drive',
			parameter: 'drive',
			alias: 'd',
		},
	],
	permission: 'user',
	root: true,
	action(params, options) {
		const Bluebird = require('bluebird');
		const config = require('balena-config-json');
		const umountAsync = Bluebird.promisify(require('umount').umount);

		return Bluebird.try(
			() => options.drive || getVisuals().drive('Select the device drive'),
		)
			.tap(umountAsync)
			.then((drive) =>
				require('fs')
					.promises.readFile(params.file, 'utf8')
					.then(JSON.parse)
					.then((configJSON) => config.write(drive, options.type, configJSON)),
			)
			.tap(() => {
				console.info('Done');
			});
	},
};

export const reconfigure = {
	signature: 'config reconfigure',
	description: 'reconfigure a provisioned device',
	help: `\
Use this command to reconfigure a provisioned device

Examples:

	$ balena config reconfigure --type raspberry-pi
	$ balena config reconfigure --type raspberry-pi --advanced
	$ balena config reconfigure --type raspberry-pi --drive /dev/disk2\
`,
	options: [
		{
			signature: 'type',
			description:
				'device type (Check available types with `balena devices supported`)',
			parameter: 'type',
			alias: 't',
			required: 'You have to specify a device type',
		},
		{
			signature: 'drive',
			description: 'drive',
			parameter: 'drive',
			alias: 'd',
		},
		{
			signature: 'advanced',
			description: 'show advanced commands',
			boolean: true,
			alias: 'v',
		},
	],
	permission: 'user',
	root: true,
	action(_params, options) {
		const Bluebird = require('bluebird');
		const config = require('balena-config-json');
		const { runCommand } = require('../utils/helpers');
		const umountAsync = Bluebird.promisify(require('umount').umount);

		return Bluebird.try(
			() => options.drive || getVisuals().drive('Select the device drive'),
		)
			.tap(umountAsync)
			.then((drive) =>
				config
					.read(drive, options.type)
					.get('uuid')
					.tap(() => umountAsync(drive))
					.then(function (uuid) {
						let configureCommand = `os configure ${drive} --device ${uuid}`;
						if (options.advanced) {
							configureCommand += ' --advanced';
						}
						return runCommand(configureCommand);
					}),
			)
			.then(() => {
				console.info('Done');
			});
	},
};

export const generate = {
	signature: 'config generate',
	description: 'generate a config.json file',
	help: `\
Use this command to generate a config.json for a device or application.

Calling this command with the exact version number of the targeted image is required.

This is interactive by default, but you can do this automatically without interactivity
by specifying an option for each question on the command line, if you know the questions
that will be asked for the relevant device type.

In case that you want to configure an image for an application with mixed device types,
you can pass the --device-type argument along with --app to specify the target device type.

Examples:

	$ balena config generate --device 7cf02a6 --version 2.12.7
	$ balena config generate --device 7cf02a6 --version 2.12.7 --generate-device-api-key
	$ balena config generate --device 7cf02a6 --version 2.12.7 --device-api-key <existingDeviceKey>
	$ balena config generate --device 7cf02a6 --version 2.12.7 --output config.json
	$ balena config generate --app MyApp --version 2.12.7
	$ balena config generate --app MyApp --version 2.12.7 --device-type fincm3
	$ balena config generate --app MyApp --version 2.12.7 --output config.json
	$ balena config generate --app MyApp --version 2.12.7 \
--network wifi --wifiSsid mySsid --wifiKey abcdefgh --appUpdatePollInterval 1\
`,
	options: [
		commandOptions.osVersion,
		commandOptions.optionalApplication,
		commandOptions.optionalDevice,
		commandOptions.optionalDeviceApiKey,
		commandOptions.optionalDeviceType,
		{
			signature: 'generate-device-api-key',
			description: 'generate a fresh device key for the device',
			boolean: true,
		},
		{
			signature: 'output',
			description: 'output',
			parameter: 'output',
			alias: 'o',
		},
		// Options for non-interactive configuration
		{
			signature: 'network',
			description: 'the network type to use: ethernet or wifi',
			parameter: 'network',
		},
		{
			signature: 'wifiSsid',
			description:
				'the wifi ssid to use (used only if --network is set to wifi)',
			parameter: 'wifiSsid',
		},
		{
			signature: 'wifiKey',
			description:
				'the wifi key to use (used only if --network is set to wifi)',
			parameter: 'wifiKey',
		},
		{
			signature: 'appUpdatePollInterval',
			description:
				'how frequently (in minutes) to poll for application updates',
			parameter: 'appUpdatePollInterval',
		},
	],
	permission: 'user',
	action(_params, options) {
		normalizeUuidProp(options, 'device');
		const Bluebird = require('bluebird');
		const balena = getBalenaSdk();
		const form = require('resin-cli-form');
		const prettyjson = require('prettyjson');

		const {
			generateDeviceConfig,
			generateApplicationConfig,
		} = require('../utils/config');
		const helpers = require('../utils/helpers');
		const { exitWithExpectedError } = require('../errors');

		if (options.device == null && options.application == null) {
			exitWithExpectedError(`\
You have to pass either a device or an application.

See the help page for examples:

  $ balena help config generate\
`);
		}

		if (!options.application && options.deviceType) {
			exitWithExpectedError(`\
Specifying a different device type is only supported when
generating a config for an application:

* An application, with --app <appname>
* A specific device type, with --device-type <deviceTypeSlug>

See the help page for examples:

  $ balena help config generate\
`);
		}

		return Bluebird.try(
			/** @returns {Promise<any>} */ function () {
				if (options.device != null) {
					return balena.models.device.get(options.device);
				}
				return balena.models.application.get(options.application);
			},
		)
			.then(function (resource) {
				const deviceType = options.deviceType || resource.device_type;
				let manifestPromise = balena.models.device.getManifestBySlug(
					deviceType,
				);

				if (options.application && options.deviceType) {
					const app = resource;
					const appManifestPromise = balena.models.device.getManifestBySlug(
						app.device_type,
					);
					manifestPromise = manifestPromise.tap((paramDeviceType) =>
						appManifestPromise.then(function (appDeviceType) {
							if (
								!helpers.areDeviceTypesCompatible(
									appDeviceType,
									paramDeviceType,
								)
							) {
								throw new balena.errors.BalenaInvalidDeviceType(
									`Device type ${options.deviceType} is incompatible with application ${options.application}`,
								);
							}
						}),
					);
				}

				return manifestPromise
					.get('options')
					.then((
						formOptions, // Pass params as an override: if there is any param with exactly the same name as a
					) =>
						// required option, that value is used (and the corresponding question is not asked)
						form.run(formOptions, { override: options }),
					)
					.then(function (answers) {
						answers.version = options.version;

						if (resource.uuid != null) {
							return generateDeviceConfig(
								resource,
								options.deviceApiKey || options['generate-device-api-key'],
								answers,
							);
						} else {
							answers.deviceType = deviceType;
							return generateApplicationConfig(resource, answers);
						}
					});
			})
			.then(function (config) {
				if (options.output != null) {
					return require('fs').promises.writeFile(
						options.output,
						JSON.stringify(config),
					);
				}

				console.log(prettyjson.render(config));
			});
	},
};
