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
import { getCliForm, stripIndent } from '../../utils/lazy';
import * as _ from 'lodash';
import type { DeviceTypeJson } from 'balena-sdk';

interface FlagsDef {
	advanced: boolean;
	output: string;
	help: void;
}

interface ArgsDef {
	image: string;
	'device-type': string;
}

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

	public static args = [
		{
			name: 'image',
			description: 'os image',
			required: true,
		},
		{
			name: 'device-type',
			description: 'device type',
			required: true,
		},
	];

	public static usage = 'os build-config <image> <device-type>';

	public static flags: flags.Input<FlagsDef> = {
		advanced: flags.boolean({
			description: 'show advanced configuration options',
			char: 'v',
		}),
		output: flags.string({
			description: 'path to output JSON file',
			char: 'o',
			required: true,
		}),
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			OsBuildConfigCmd,
		);

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

		const { getManifest } = await import('../../utils/helpers');

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
				const { getGroupDefaults } = await import('../../utils/helpers');
				override = getGroupDefaults(advancedGroup);
			}
		}

		return getCliForm().run(questions, { override });
	}
}
