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
import type { IArg } from '@oclif/parser/lib/args';
import Command from '../../command';
import * as cf from '../../utils/common-flags';
import { getBalenaSdk, stripIndent, getCliForm } from '../../utils/lazy';

interface FlagsDef {
	help: void;
}

interface ArgsDef {
	uuid: string;
	newName?: string;
}

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

	public static args: Array<IArg<any>> = [
		{
			name: 'uuid',
			description: 'the uuid of the device to rename',
			required: true,
		},
		{
			name: 'newName',
			description: 'the new name for the device',
		},
	];

	public static usage = 'device rename <uuid> [newName]';

	public static flags: flags.Input<FlagsDef> = {
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = this.parse<FlagsDef, ArgsDef>(DeviceRenameCmd);

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
