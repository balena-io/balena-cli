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
import { stripIndent } from '../../utils/lazy';

interface FlagsDef {
	output: string;
	version?: string;
	help: void;
}

interface ArgsDef {
	type: string;
}

export default class OsDownloadCmd extends Command {
	public static description = stripIndent`
		Download an unconfigured OS image.

		Download an unconfigured OS image for a certain device type.
		Check available types with \`balena devices supported\`

		Note: Currently this command only works with balenaCloud, not openBalena.
		If using openBalena, please download the OS from: https://www.balena.io/os/

		If version is not specified the newest stable (non-pre-release) version of OS
		is downloaded (if available), otherwise the newest version (if all existing
		versions for the given device type are pre-release).

		You can pass \`--version menu\` to pick the OS version from the interactive menu
		of all available versions.

		To download a development image append \`.dev\` to the version or select from
		the interactive menu.
`;
	public static examples = [
		'$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img',
		'$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version 2.60.1+rev1',
		'$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version 2.60.1+rev1.dev',
		'$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version ^2.60.0',
		'$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version latest',
		'$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version default',
		'$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version menu',
	];

	public static args = [
		{
			name: 'type',
			description: 'the device type',
			required: true,
		},
	];

	public static usage = 'os download <type>';

	public static flags: flags.Input<FlagsDef> = {
		output: flags.string({
			description: 'output path',
			char: 'o',
			required: true,
		}),
		version: flags.string({
			description: stripIndent`
				exact version number, or a valid semver range,
				or 'latest' (includes pre-releases),
				or 'default' (excludes pre-releases if at least one stable version is available),
				or 'recommended' (excludes pre-releases, will fail if only pre-release versions are available),
				or 'menu' (will show the interactive menu)
				`,
		}),
		help: cf.help,
	};

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			OsDownloadCmd,
		);

		const { downloadOSImage } = await import('../../utils/cloud');

		await downloadOSImage(params.type, options.output, options.version);
	}
}
