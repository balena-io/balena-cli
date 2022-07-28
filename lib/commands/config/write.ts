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
	key: string;
	value: string;
}

export default class ConfigWriteCmd extends Command {
	public static description = stripIndent`
		Write a key-value pair to the config.json file of an OS image or attached media.

		Write a key-value pair to the 'config.json' file of a balenaOS image file or
		attached SD card or USB stick.

		Documentation for the balenaOS 'config.json' file can be found at:
		https://www.balena.io/docs/reference/OS/configuration/
	`;

	public static examples = [
		'$ balena config write ntpServers "0.resinio.pool.ntp.org 1.resinio.pool.ntp.org"',
		'$ balena config write --drive /dev/disk2 hostname custom-hostname',
		'$ balena config write --drive balena.img os.network.connectivity.interval 300',
	];

	public static args = [
		{
			name: 'key',
			description: 'the key of the config parameter to write',
			required: true,
		},
		{
			name: 'value',
			description: 'the value of the config parameter to write',
			required: true,
		},
	];

	public static usage = 'config write <key> <value>';

	public static flags: flags.Input<FlagsDef> = {
		drive: cf.driveOrImg,
		help: cf.help,
	};

	public static root = true;
	public static offlineCompatible = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			ConfigWriteCmd,
		);

		const { denyMount, safeUmount } = await import('../../utils/umount');

		const drive =
			options.drive || (await getVisuals().drive('Select the device drive'));
		await safeUmount(drive);

		const config = await import('balena-config-json');
		const configJSON = await config.read(drive, '');

		console.info(`Setting ${params.key} to ${params.value}`);
		ConfigWriteCmd.updateConfigJson(configJSON, params.key, params.value);

		await denyMount(drive, async () => {
			await safeUmount(drive);
			await config.write(drive, '', configJSON);
		});

		console.info('Done');
	}

	/** Call Lodash's _.setWith(). Moved here for ease of testing. */
	static updateConfigJson(configJSON: object, key: string, value: string) {
		const _ = require('lodash') as typeof import('lodash');
		// note: _.setWith() is needed instead of _.set() because, given a key
		// like `os.udevRules.101`, _.set() creates a udevRules array (rather
		// than a dictionary) and sets the 101st array element to value, while
		// we actually want udevRules to be dictionary like { '101': value }
		_.setWith(configJSON, key, value, (v) => v || {});
	}
}
