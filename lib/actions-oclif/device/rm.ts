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
import { stripIndent } from 'common-tags';
import Command from '../../command';
import * as cf from '../../utils/common-flags';
import { getBalenaSdk } from '../../utils/lazy';
import { tryAsInteger } from '../../utils/validation';

interface FlagsDef {
	yes: boolean;
	help: void;
}

interface ArgsDef {
	uuid: string;
}

export default class DeviceRmCmd extends Command {
	public static description = stripIndent`
		Remove a device.

		Remove a device from balena.

		Note this command asks for confirmation interactively.
		You can avoid this by passing the \`--yes\` option.
		`;
	public static examples = [
		'$ balena device rm 7cf02a6',
		'$ balena device rm 7cf02a6 --yes',
	];

	public static args: Array<IArg<any>> = [
		{
			name: 'uuid',
			description: 'the uuid of the device to remove',
			parse: (dev) => tryAsInteger(dev),
			required: true,
		},
	];

	public static usage = 'device rm <uuid>';

	public static flags: flags.Input<FlagsDef> = {
		yes: cf.yes,
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			DeviceRmCmd,
		);

		const balena = getBalenaSdk();
		const patterns = await import('../../utils/patterns');

		// Confirm
		await patterns.confirm(
			options.yes,
			'Are you sure you want to delete the device?',
		);

		// Remove
		await balena.models.device.remove(params.uuid);
	}
}
