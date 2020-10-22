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
import { getVisuals, stripIndent } from '../../utils/lazy';

interface FlagsDef {
	type: string;
	drive?: string;
	help: void;
}

interface ArgsDef {
	key: string;
	value: string;
}

export default class ConfigWriteCmd extends Command {
	public static description = stripIndent`
		Write a key-value pair to configuration of a device or OS image.

		Write a key-value pair to the config.json file on the mounted filesystem,
		e.g. the SD card of a provisioned device or balenaOS image.
	`;

	public static examples = [
		'$ balena config write --type raspberrypi3 username johndoe',
		'$ balena config write --type raspberrypi3 --drive /dev/disk2 username johndoe',
		'$ balena config write --type raspberrypi3 files.network/settings "..."',
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
		type: flags.string({
			description:
				'device type (Check available types with `balena devices supported`)',
			char: 't',
			required: true,
		}),
		drive: flags.string({
			description: 'device filesystem or OS image location',
			char: 'd',
		}),
		help: cf.help,
	};

	public static authenticated = true;

	public static root = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			ConfigWriteCmd,
		);

		const { promisify } = await import('util');
		const umountAsync = promisify((await import('umount')).umount);

		const drive =
			options.drive || (await getVisuals().drive('Select the device drive'));
		await umountAsync(drive);

		const config = await import('balena-config-json');
		const configJSON = await config.read(drive, options.type);

		console.info(`Setting ${params.key} to ${params.value}`);
		const _ = await import('lodash');
		_.set(configJSON, params.key, params.value);

		await umountAsync(drive);

		await config.write(drive, options.type, configJSON);

		console.info('Done');
	}
}
