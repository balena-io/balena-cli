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

import * as _ from 'lodash';
import { normalizeUuidProp } from '../utils/normalization';
import { getBalenaSdk, getVisuals } from '../utils/lazy';

/** @type {import('balena-sdk').PineOptionsFor<import('balena-sdk').Device>} */
const expandForAppName = {
	$expand: { belongs_to__application: { $select: 'app_name' } },
};

export const list = {
	signature: 'devices',
	description: 'list all devices',
	help: `\
Use this command to list all devices that belong to you.

You can filter the devices by application by using the \`--application\` option.

Examples:

	$ balena devices
	$ balena devices --application MyApp
	$ balena devices --app MyApp
	$ balena devices -a MyApp\
`,
	options: [commandOptions.optionalApplication],
	permission: 'user',
	primary: true,
	action(_params, options) {
		const Promise = require('bluebird');
		const balena = getBalenaSdk();

		return Promise.try(function() {
			if (options.application != null) {
				return balena.models.device.getAllByApplication(
					options.application,
					expandForAppName,
				);
			}
			return balena.models.device.getAll(expandForAppName);
		}).tap(function(devices) {
			devices = _.map(devices, function(device) {
				// @ts-ignore extending the device object with extra props
				device.dashboard_url = balena.models.device.getDashboardUrl(
					device.uuid,
				);
				// @ts-ignore extending the device object with extra props
				device.application_name = device.belongs_to__application?.[0]
					? device.belongs_to__application[0].app_name
					: 'N/a';
				device.uuid = device.uuid.slice(0, 7);
				return device;
			});

			console.log(
				getVisuals().table.horizontal(devices, [
					'id',
					'uuid',
					'device_name',
					'device_type',
					'application_name',
					'status',
					'is_online',
					'supervisor_version',
					'os_version',
					'dashboard_url',
				]),
			);
		});
	},
};

export const info = {
	signature: 'device <uuid>',
	description: 'list a single device',
	help: `\
Use this command to show information about a single device.

Examples:

	$ balena device 7cf02a6\
`,
	permission: 'user',
	primary: true,
	action(params) {
		normalizeUuidProp(params);
		const balena = getBalenaSdk();

		return balena.models.device
			.get(params.uuid, expandForAppName)
			.then(device =>
				// @ts-ignore `device.getStatus` requires a device with service info, but
				// this device isn't typed with them, possibly needs fixing?
				balena.models.device.getStatus(params.uuid).then(function(status) {
					device.status = status;
					// @ts-ignore extending the device object with extra props
					device.dashboard_url = balena.models.device.getDashboardUrl(
						device.uuid,
					);
					// @ts-ignore extending the device object with extra props
					device.application_name = device.belongs_to__application?.[0]
						? device.belongs_to__application[0].app_name
						: 'N/a';
					// @ts-ignore extending the device object with extra props
					device.commit = device.is_on__commit;

					console.log(
						getVisuals().table.vertical(device, [
							`$${device.device_name}$`,
							'id',
							'device_type',
							'status',
							'is_online',
							'ip_address',
							'application_name',
							'last_seen',
							'uuid',
							'commit',
							'supervisor_version',
							'is_web_accessible',
							'note',
							'os_version',
							'dashboard_url',
						]),
					);
				}),
			);
	},
};

export const register = {
	signature: 'device register <application>',
	description: 'register a device',
	help: `\
Use this command to register a device to an application.

Examples:

	$ balena device register MyApp
	$ balena device register MyApp --uuid <uuid>\
`,
	permission: 'user',
	options: [
		{
			signature: 'uuid',
			description: 'custom uuid',
			parameter: 'uuid',
			alias: 'u',
		},
	],
	action(params, options) {
		const Promise = require('bluebird');
		const balena = getBalenaSdk();

		return Promise.join(
			balena.models.application.get(params.application),
			options.uuid ?? balena.models.device.generateUniqueKey(),
			function(application, uuid) {
				console.info(`Registering to ${application.app_name}: ${uuid}`);
				return balena.models.device.register(application.id, uuid);
			},
		).get('uuid');
	},
};

export const remove = {
	signature: 'device rm <uuid>',
	description: 'remove a device',
	help: `\
Use this command to remove a device from balena.

Notice this command asks for confirmation interactively.
You can avoid this by passing the \`--yes\` boolean option.

Examples:

	$ balena device rm 7cf02a6
	$ balena device rm 7cf02a6 --yes\
`,
	options: [commandOptions.yes],
	permission: 'user',
	action(params, options) {
		normalizeUuidProp(params);
		const balena = getBalenaSdk();
		const patterns = require('../utils/patterns');

		return patterns
			.confirm(options.yes, 'Are you sure you want to delete the device?')
			.then(() => balena.models.device.remove(params.uuid));
	},
};

export const identify = {
	signature: 'device identify <uuid>',
	description: 'identify a device with a UUID',
	help: `\
Use this command to identify a device.

In the Raspberry Pi, the ACT led is blinked several times.

Examples:

	$ balena device identify 23c73a1\
`,
	permission: 'user',
	action(params) {
		normalizeUuidProp(params);
		const balena = getBalenaSdk();
		return balena.models.device.identify(params.uuid);
	},
};

export const reboot = {
	signature: 'device reboot <uuid>',
	description: 'restart a device',
	help: `\
Use this command to remotely reboot a device

Examples:

	$ balena device reboot 23c73a1\
`,
	options: [commandOptions.forceUpdateLock],
	permission: 'user',
	action(params, options) {
		normalizeUuidProp(params);
		const balena = getBalenaSdk();
		return balena.models.device.reboot(params.uuid, options);
	},
};

export const shutdown = {
	signature: 'device shutdown <uuid>',
	description: 'shutdown a device',
	help: `\
Use this command to remotely shutdown a device

Examples:

	$ balena device shutdown 23c73a1\
`,
	options: [commandOptions.forceUpdateLock],
	permission: 'user',
	action(params, options) {
		normalizeUuidProp(params);
		const balena = getBalenaSdk();
		return balena.models.device.shutdown(params.uuid, options);
	},
};

export const rename = {
	signature: 'device rename <uuid> [newName]',
	description: 'rename a balena device',
	help: `\
Use this command to rename a device.

If you omit the name, you'll get asked for it interactively.

Examples:

	$ balena device rename 7cf02a6
	$ balena device rename 7cf02a6 MyPi\
`,
	permission: 'user',
	action(params) {
		normalizeUuidProp(params);
		const Promise = require('bluebird');
		const balena = getBalenaSdk();
		const form = require('resin-cli-form');

		return Promise.try(function() {
			if (!_.isEmpty(params.newName)) {
				return params.newName;
			}

			return form.ask({
				message: 'How do you want to name this device?',
				type: 'input',
			});
		}).then(_.partial(balena.models.device.rename, params.uuid));
	},
};

export const move = {
	signature: 'device move <uuid>',
	description: 'move a device to another application',
	help: `\
Use this command to move a device to another application you own.

If you omit the application, you'll get asked for it interactively.

Examples:

	$ balena device move 7cf02a6
	$ balena device move 7cf02a6 --application MyNewApp\
`,
	permission: 'user',
	options: [commandOptions.optionalApplication],
	action(params, options) {
		normalizeUuidProp(params);
		const balena = getBalenaSdk();
		const patterns = require('../utils/patterns');

		return balena.models.device
			.get(params.uuid, expandForAppName)
			.then(function(device) {
				// @ts-ignore extending the device object with extra props
				device.application_name = device.belongs_to__application?.[0]
					? device.belongs_to__application[0].app_name
					: 'N/a';
				if (options.application) {
					return options.application;
				}

				return Promise.all([
					balena.models.device.getManifestBySlug(device.device_type),
					balena.models.config.getDeviceTypes(),
				]).then(function([deviceDeviceType, deviceTypes]) {
					const compatibleDeviceTypes = deviceTypes.filter(
						dt =>
							balena.models.os.isArchitectureCompatibleWith(
								deviceDeviceType.arch,
								dt.arch,
							) &&
							!!dt.isDependent === !!deviceDeviceType.isDependent &&
							dt.state !== 'DISCONTINUED',
					);

					return patterns.selectApplication(application =>
						_.every([
							_.some(
								compatibleDeviceTypes,
								dt => dt.slug === application.device_type,
							),
							// @ts-ignore using the extended device object prop
							device.application_name !== application.app_name,
						]),
					);
				});
			})
			.tap(application => balena.models.device.move(params.uuid, application))
			.then(application => {
				console.info(`${params.uuid} was moved to ${application}`);
			});
	},
};

export const init = {
	signature: 'device init',
	description: 'initialise a device with balenaOS',
	help: `\
Use this command to download the OS image of a certain application and write it to an SD Card.

Notice this command may ask for confirmation interactively.
You can avoid this by passing the \`--yes\` boolean option.

Examples:

	$ balena device init
	$ balena device init --application MyApp\
`,
	options: [
		commandOptions.optionalApplication,
		commandOptions.yes,
		commandOptions.advancedConfig,
		_.assign({}, commandOptions.osVersionOrSemver, {
			signature: 'os-version',
			parameter: 'os-version',
		}),
		commandOptions.drive,
		{
			signature: 'config',
			description: 'path to the config JSON file, see `balena os build-config`',
			parameter: 'config',
		},
	],
	permission: 'user',
	action(_params, options) {
		const Promise = require('bluebird');
		const rimraf = Promise.promisify(require('rimraf'));
		const tmp = require('tmp');
		const tmpNameAsync = Promise.promisify(tmp.tmpName);
		tmp.setGracefulCleanup();

		const balena = getBalenaSdk();
		const patterns = require('../utils/patterns');
		const { runCommand } = require('../utils/helpers');

		return Promise.try(function() {
			if (options.application != null) {
				return options.application;
			}
			return patterns.selectApplication();
		})
			.then(balena.models.application.get)
			.then(function(application) {
				const download = () =>
					tmpNameAsync()
						.then(function(tempPath) {
							const osVersion = options['os-version'] || 'default';
							return runCommand(
								`os download ${application.device_type} --output '${tempPath}' --version ${osVersion}`,
							);
						})
						.disposer(tempPath => rimraf(tempPath));

				return Promise.using(download(), tempPath =>
					runCommand(`device register ${application.app_name}`)
						.then(balena.models.device.get)
						.tap(function(device) {
							let configureCommand = `os configure '${tempPath}' --device ${device.uuid}`;
							if (options.config) {
								configureCommand += ` --config '${options.config}'`;
							} else if (options.advanced) {
								configureCommand += ' --advanced';
							}
							return runCommand(configureCommand)
								.then(function() {
									let osInitCommand = `os initialize '${tempPath}' --type ${application.device_type}`;
									if (options.yes) {
										osInitCommand += ' --yes';
									}
									if (options.drive) {
										osInitCommand += ` --drive ${options.drive}`;
									}
									return runCommand(osInitCommand);
								})
								.catch(error =>
									balena.models.device.remove(device.uuid).finally(function() {
										throw error;
									}),
								);
						}),
				).then(function(device) {
					console.log('Done');
					return device.uuid;
				});
			});
	},
};

export { osUpdate } from './device_ts';
