/**
 * @license
 * Copyright 2016-2021 Balena Ltd.
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
import { getVisuals, stripIndent } from '../../utils/lazy';

interface FlagsDef {
	type?: string;
	drive?: string;
	help: void;
}

interface ArgsDef {
	file: string;
}

export default class ConfigInjectCmd extends Command {
	public static description = stripIndent`
		Inject a config.json file to a balenaOS image or attached media.

		Inject a 'config.json' file to a balenaOS image file or attached SD card or
		USB stick.

		Documentation for the balenaOS 'config.json' file can be found at:
		https://www.balena.io/docs/reference/OS/configuration/
	`;

	public static examples = [
		'$ balena config inject my/config.json',
		'$ balena config inject my/config.json --drive /dev/disk2',
	];

	public static args = [
		{
			name: 'file',
			description: 'the path to the config.json file to inject',
			required: true,
		},
	];

	public static usage = 'config inject <file>';

	public static flags: flags.Input<FlagsDef> = {
		...cf.deviceTypeIgnored,
		drive: cf.driveOrImg,
		help: cf.help,
	};

	public static root = true;
	public static offlineCompatible = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			ConfigInjectCmd,
		);

		const { safeUmount } = await import('../../utils/umount');

		const drive =
			options.drive || (await getVisuals().drive('Select the device/OS drive'));
		await safeUmount(drive);

		const fs = await import('fs');
		const configJSON = JSON.parse(
			await fs.promises.readFile(params.file, 'utf8'),
		);

		const config = await import('balena-config-json');
		await config.write(drive, '', configJSON);

		console.info('Done');
	}
}
