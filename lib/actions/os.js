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
import { getCliForm } from '../utils/lazy';

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
