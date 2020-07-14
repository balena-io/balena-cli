/*
Copyright 2016-2020 Balena

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
import { getBalenaSdk, getVisuals, getCliForm } from '../utils/lazy';

const formatVersion = function (v, isRecommended) {
	let result = `v${v}`;
	if (isRecommended) {
		result += ' (recommended)';
	}
	return result;
};

const resolveVersion = function (deviceType, version) {
	if (version !== 'menu') {
		if (version[0] === 'v') {
			version = version.slice(1);
		}
		return Promise.resolve(version);
	}

	const balena = getBalenaSdk();

	return balena.models.os
		.getSupportedVersions(deviceType)
		.then(function ({ versions: vs, recommended }) {
			const choices = vs.map((v) => ({
				value: v,
				name: formatVersion(v, v === recommended),
			}));

			return getCliForm().ask({
				message: 'Select the OS version:',
				type: 'list',
				choices,
				default: recommended,
			});
		});
};

export const download = {
	signature: 'os download <type>',
	description: 'download an unconfigured os image',
	help: `\
Use this command to download an unconfigured os image for a certain device type.
Check available types with \`balena devices supported\`

> Note: Currently this command only works with balenaCloud, not openBalena.
> If using openBalena, please download the OS from: https://www.balena.io/os/

If version is not specified the newest stable (non-pre-release) version of OS
is downloaded if available, or the newest version otherwise (if all existing
versions for the given device type are pre-release).

You can pass \`--version menu\` to pick the OS version from the interactive menu
of all available versions.

Examples:

	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version 1.24.1
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version ^1.20.0
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version latest
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version default
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version menu\
`,
	options: [
		{
			signature: 'output',
			description: 'output path',
			parameter: 'output',
			alias: 'o',
			required: 'You have to specify the output location',
		},
		commandOptions.osVersionOrSemver,
	],
	action(params, options) {
		const Bluebird = require('bluebird');
		const unzip = require('node-unzip-2');
		const fs = require('fs');
		const manager = require('balena-image-manager');

		console.info(`Getting device operating system for ${params.type}`);

		let displayVersion = '';
		return Bluebird.try(function () {
			if (!options.version) {
				console.warn(`OS version is not specified, using the default version: \
the newest stable (non-pre-release) version if available, \
or the newest version otherwise (if all existing \
versions for the given device type are pre-release).`);
				return 'default';
			}
			return resolveVersion(params.type, options.version);
		})
			.then(function (version) {
				if (version !== 'default') {
					displayVersion = ` ${version}`;
				}
				return manager.get(params.type, version);
			})
			.then(async function (stream) {
				const visuals = getVisuals();
				const bar = new visuals.Progress(
					`Downloading Device OS${displayVersion}`,
				);
				const spinner = new visuals.Spinner(
					`Downloading Device OS${displayVersion} (size unknown)`,
				);

				stream.on('progress', function (state) {
					if (state != null) {
						return bar.update(state);
					} else {
						return spinner.start();
					}
				});

				stream.on('end', () => {
					spinner.stop();
				});

				// We completely rely on the `mime` custom property
				// to make this decision.
				// The actual stream should be checked instead.
				let output;
				if (stream.mime === 'application/zip') {
					output = unzip.Extract({ path: options.output });
				} else {
					output = fs.createWriteStream(options.output);
				}

				const streamToPromise = await import('stream-to-promise');
				await streamToPromise(stream.pipe(output));
				return options.output;
			})
			.tap(() => {
				console.info('The image was downloaded successfully');
			});
	},
};

const buildConfigForDeviceType = function (deviceType, advanced) {
	if (advanced == null) {
		advanced = false;
	}
	const helpers = require('../utils/helpers');

	let override;
	const questions = deviceType.options;
	if (!advanced) {
		const advancedGroup = _.find(questions, {
			name: 'advanced',
			isGroup: true,
		});

		if (advancedGroup != null) {
			override = helpers.getGroupDefaults(advancedGroup);
		}
	}

	return getCliForm().run(questions, { override });
};

const $buildConfig = function (image, deviceTypeSlug, advanced) {
	if (advanced == null) {
		advanced = false;
	}
	const Bluebird = require('bluebird');
	const helpers = require('../utils/helpers');

	return Bluebird.resolve(
		helpers.getManifest(image, deviceTypeSlug),
	).then((deviceTypeManifest) =>
		buildConfigForDeviceType(deviceTypeManifest, advanced),
	);
};

export const buildConfig = {
	signature: 'os build-config <image> <device-type>',
	description: 'build the OS config and save it to the JSON file',
	help: `\
Use this command to prebuild the OS config once and skip the interactive part of \`balena os configure\`.

Example:

	$ balena os build-config ../path/rpi3.img raspberrypi3 --output rpi3-config.json
	$ balena os configure ../path/rpi3.img --device 7cf02a6 --config rpi3-config.json\
`,
	permission: 'user',
	options: [
		commandOptions.advancedConfig,
		{
			signature: 'output',
			description: 'the path to the output JSON file',
			alias: 'o',
			required: 'the output path is required',
			parameter: 'output',
		},
	],
	action(params, options) {
		return $buildConfig(
			params.image,
			params['device-type'],
			options.advanced,
		).then((answers) =>
			require('fs').promises.writeFile(
				options.output,
				JSON.stringify(answers, null, 4),
			),
		);
	},
};

const INIT_WARNING_MESSAGE = `\
Note: Initializing the device may ask for administrative permissions
because we need to access the raw devices directly.\
`;

export const initialize = {
	signature: 'os initialize <image>',
	description: 'initialize an os image',
	help: `\
Use this command to initialize a device with previously configured operating system image.

${INIT_WARNING_MESSAGE}

Examples:

	$ balena os initialize ../path/rpi.img --type 'raspberry-pi'\
`,
	permission: 'user',
	options: [
		commandOptions.yes,
		{
			signature: 'type',
			description:
				'device type (Check available types with `balena devices supported`)',
			parameter: 'type',
			alias: 't',
			required: 'You have to specify a device type',
		},
		commandOptions.drive,
	],
	action(params, options) {
		const Bluebird = require('bluebird');
		const umountAsync = Bluebird.promisify(require('umount').umount);
		const patterns = require('../utils/patterns');
		const helpers = require('../utils/helpers');

		console.info(`\
Initializing device

${INIT_WARNING_MESSAGE}\
`);
		return Bluebird.resolve(helpers.getManifest(params.image, options.type))
			.then((manifest) =>
				getCliForm().run(manifest.initialization?.options, {
					override: {
						drive: options.drive,
					},
				}),
			)
			.tap(function (answers) {
				if (answers.drive == null) {
					return;
				}
				return patterns
					.confirm(
						options.yes,
						`This will erase ${answers.drive}. Are you sure?`,
						`Going to erase ${answers.drive}.`,
						true,
					)
					.then(() => umountAsync(answers.drive));
			})
			.tap((answers) =>
				helpers.sudo([
					'internal',
					'osinit',
					params.image,
					options.type,
					JSON.stringify(answers),
				]),
			)
			.then(function (answers) {
				if (answers.drive == null) {
					return;
				}

				// TODO: balena local makes use of ejectAsync, see below
				// DO we need this / should we do that here?

				// getDrive = (drive) ->
				// 	driveListAsync().then (drives) ->
				// 		selectedDrive = _.find(drives, device: drive)

				// 		if not selectedDrive?
				// 			throw new Error("Drive not found: #{drive}")

				// 		return selectedDrive
				// if (os.platform() is 'win32') and selectedDrive.mountpoint?
				// 	ejectAsync = Promise.promisify(require('removedrive').eject)
				// 	return ejectAsync(selectedDrive.mountpoint)

				return umountAsync(answers.drive).tap(() => {
					console.info(`You can safely remove ${answers.drive} now`);
				});
			});
	},
};
