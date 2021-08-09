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
import { getBalenaSdk, getCliUx, stripIndent } from '../../utils/lazy';

interface FlagsDef {
	help: void;
}

interface ArgsDef {
	uuid: string;
}

export default class DevicePurgeCmd extends Command {
	public static description = stripIndent`
		Purge data from a device.

		Purge data from a device.
		This will clear the device's "/data" directory.

		Multiple devices may be specified with a comma-separated list
		of values (no spaces).
		`;
	public static examples = [
		'$ balena device purge 23c73a1',
		'$ balena device purge 55d43b3,23c73a1',
	];

	public static usage = 'device purge <uuid>';

	public static args: Array<IArg<any>> = [
		{
			name: 'uuid',
			description: 'comma-separated list (no blank spaces) of device UUIDs',
			required: true,
		},
	];

	public static flags: flags.Input<FlagsDef> = {
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = this.parse<FlagsDef, ArgsDef>(DevicePurgeCmd);

		const { tryAsInteger } = await import('../../utils/validation');
		const balena = getBalenaSdk();
		const ux = getCliUx();

		const deviceIds = params.uuid.split(',').map((id) => {
			return tryAsInteger(id);
		});

		for (const deviceId of deviceIds) {
			ux.action.start(`Purging data from device ${deviceId}`);
			await balena.models.device.purge(deviceId);
			ux.action.stop();
		}
	}
}
