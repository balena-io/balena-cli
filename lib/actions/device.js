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
import { getBalenaSdk } from '../utils/lazy';

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

		return Promise.try(function () {
			if (options.application != null) {
				return options.application;
			}
			return patterns.selectApplication();
		})
			.then(balena.models.application.get)
			.then(function (application) {
				const download = () =>
					tmpNameAsync()
						.then(function (tempPath) {
							const osVersion = options['os-version'] || 'default';
							return runCommand(
								`os download ${application.device_type} --output '${tempPath}' --version ${osVersion}`,
							);
						})
						.disposer((tempPath) => rimraf(tempPath));

				return Promise.using(download(), (tempPath) =>
					runCommand(`device register ${application.app_name}`)
						.then(balena.models.device.get)
						.tap(function (device) {
							let configureCommand = `os configure '${tempPath}' --device ${device.uuid}`;
							if (options.config) {
								configureCommand += ` --config '${options.config}'`;
							} else if (options.advanced) {
								configureCommand += ' --advanced';
							}
							return runCommand(configureCommand)
								.then(function () {
									let osInitCommand = `os initialize '${tempPath}' --type ${application.device_type}`;
									if (options.yes) {
										osInitCommand += ' --yes';
									}
									if (options.drive) {
										osInitCommand += ` --drive ${options.drive}`;
									}
									return runCommand(osInitCommand);
								})
								.catch((error) =>
									balena.models.device.remove(device.uuid).finally(function () {
										throw error;
									}),
								);
						}),
				).then(function (device) {
					console.log('Done');
					return device.uuid;
				});
			});
	},
};
