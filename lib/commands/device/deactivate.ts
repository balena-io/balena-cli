/**
 * @license
 * Copyright 2020 Balena Ltd.
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
import { getBalenaSdk, stripIndent } from '../../utils/lazy';

interface FlagsDef {
	yes: boolean;
	help: void;
}

interface ArgsDef {
	uuid: string;
}

export default class DeviceDeactivateCmd extends Command {
	public static description = stripIndent`
		Deactivate a device.

		Deactivate a device.

		Note this command asks for confirmation interactively.
		You can avoid this by passing the \`--yes\` option.
		`;
	public static examples = [
		'$ balena device deactivate 7cf02a6',
		'$ balena device deactivate 7cf02a6 --yes',
	];

	public static args: Array<IArg<any>> = [
		{
			name: 'uuid',
			description: 'the UUID of the device to be deactivated',
			required: true,
		},
	];

	public static usage = 'device deactivate <uuid>';

	public static flags: flags.Input<FlagsDef> = {
		yes: cf.yes,
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			DeviceDeactivateCmd,
		);

		const balena = getBalenaSdk();
		const patterns = await import('../../utils/patterns');

		const uuid = params.uuid;
		const deactivationWarning = `
Warning! Deactivating a device will charge a fee equivalent to the
normal monthly cost for the device (e.g. $1 for an essentials device);
the device will not be charged again until it comes online.
`;

		const warning = `Are you sure you want to deactivate device ${uuid} ?`;

		console.error(deactivationWarning);
		// Confirm
		await patterns.confirm(options.yes, warning);
		// Deactivate
		await balena.models.device.deactivate(uuid);
	}
}
