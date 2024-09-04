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

import { Args } from '@oclif/core';
import Command from '../../command.js';
import * as cf from '../../utils/common-flags.js';
import { getBalenaSdk, stripIndent, getCliForm } from '../../utils/lazy.js';

export default class DeviceRenameCmd extends Command {
	public static description = stripIndent`
		Rename a device.

		Rename a device.

		Note, if the name is omitted, it will be prompted for interactively.
		`;
	public static examples = [
		'$ balena device rename 7cf02a6',
		'$ balena device rename 7cf02a6 MyPi',
	];

	public static args = {
		uuid: Args.string({
			description: 'the uuid of the device to rename',
			required: true,
		}),
		newName: Args.string({
			description: 'the new name for the device',
		}),
	};

	public static usage = 'device rename <uuid> [newName]';

	public static flags = {
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = await this.parse(DeviceRenameCmd);

		const balena = getBalenaSdk();

		const newName =
			params.newName ||
			(await getCliForm().ask({
				message: 'How do you want to name this device?',
				type: 'input',
			})) ||
			'';

		await balena.models.device.rename(params.uuid, newName);
	}
}
