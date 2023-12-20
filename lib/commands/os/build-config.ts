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

import { Flags, Args } from '@oclif/core';
import Command from '../../command.js';
import * as cf from '../../utils/common-flags.js';
import { getCliForm, stripIndent } from '../../utils/lazy.js';
import _ from 'lodash';
import type { DeviceTypeJson } from 'balena-sdk';

export default class OsBuildConfigCmd extends Command {
	public static description = stripIndent`
		Prepare a configuration file for use by the 'os configure' command.

		Interactively generate a configuration file that can then be used as
		non-interactive input by the 'balena os configure' command.
	`;

	public static examples = [
		'$ balena os build-config ../path/rpi3.img raspberrypi3 --output rpi3-config.json',
		'$ balena os configure ../path/rpi3.img --device 7cf02a6 --config rpi3-config.json',
	];

	public static args = {
		image: Args.string({
			description: 'os image',
			required: true,
		}),
		'device-type': Args.string({
			description: 'device type',
			required: true,
		}),
	};

	public static usage = 'os build-config <image> <device-type>';

	public static flags = {
		advanced: Flags.boolean({
			description: 'show advanced configuration options',
			char: 'v',
		}),
		output: Flags.string({
			description: 'path to output JSON file',
			char: 'o',
			required: true,
		}),
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(OsBuildConfigCmd);

		const { writeFile } = (await import('fs')).promises;

		const config = await this.buildConfig(
			params.image,
			params['device-type'],
			options.advanced,
		);

		await writeFile(options.output, JSON.stringify(config, null, 4));

		console.info(`Config file "${options.output}" created successfully.`);
	}

	async buildConfig(image: string, deviceTypeSlug: string, advanced: boolean) {
		advanced = advanced || false;

		const { getManifest } = await import('../../utils/helpers.js');

		const deviceTypeManifest = await getManifest(image, deviceTypeSlug);
		return this.buildConfigForDeviceType(deviceTypeManifest, advanced);
	}

	async buildConfigForDeviceType(
		deviceTypeManifest: DeviceTypeJson.DeviceType,
		advanced: boolean,
	) {
		advanced ??= false;

		let override;
		const questions = deviceTypeManifest.options;
		if (!advanced) {
			const advancedGroup = _.find(questions, {
				name: 'advanced',
				isGroup: true,
			});

			if (advancedGroup != null) {
				const { getGroupDefaults } = await import('../../utils/helpers.js');
				override = getGroupDefaults(advancedGroup);
			}
		}

		return getCliForm().run(questions, { override });
	}
}
