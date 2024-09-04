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

import Command from '../../command.js';
import * as cf from '../../utils/common-flags.js';
import { getVisuals, stripIndent } from '../../utils/lazy.js';

export default class ConfigReadCmd extends Command {
	public static description = stripIndent`
		Read the config.json file of a balenaOS image or attached media.

		Read the 'config.json' file of a balenaOS image file or attached SD card or
		USB stick.

		Documentation for the balenaOS 'config.json' file can be found at:
		https://www.balena.io/docs/reference/OS/configuration/
	`;

	public static examples = [
		'$ balena config read',
		'$ balena config read --drive /dev/disk2',
		'$ balena config read --drive balena.img',
	];

	public static usage = 'config read';

	public static flags = {
		drive: cf.driveOrImg,
		help: cf.help,
		json: cf.json,
	};

	public static root = true;
	public static offlineCompatible = true;

	public async run() {
		const { flags: options } = await this.parse(ConfigReadCmd);

		const { safeUmount } = await import('../../utils/umount.js');

		const drive =
			options.drive || (await getVisuals().drive('Select the device drive'));
		await safeUmount(drive);

		const config = await import('balena-config-json');
		const configJSON = await config.read(drive, '');

		if (options.json) {
			console.log(JSON.stringify(configJSON, null, 4));
		} else {
			const prettyjson = await import('prettyjson');
			console.log(prettyjson.render(configJSON));
		}
	}
}
