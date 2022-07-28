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
import { getBalenaSdk, stripIndent } from '../../utils/lazy';
import { ExpectedError } from '../../errors';

interface FlagsDef {
	force: boolean;
	help: void;
}

interface ArgsDef {
	uuid: string;
}

export default class DeviceShutdownCmd extends Command {
	public static description = stripIndent`
		Shutdown a device.

		Remotely shutdown a device.
		`;
	public static examples = ['$ balena device shutdown 23c73a1'];

	public static args: Array<IArg<any>> = [
		{
			name: 'uuid',
			description: 'the uuid of the device to shutdown',
			required: true,
		},
	];

	public static usage = 'device shutdown <uuid>';

	public static flags: flags.Input<FlagsDef> = {
		force: cf.force,
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			DeviceShutdownCmd,
		);

		const balena = getBalenaSdk();

		try {
			await balena.models.device.shutdown(params.uuid, options);
		} catch (e) {
			// Expected message: 'Request error: No online device(s) found'
			if (e.message?.toLowerCase().includes('online')) {
				throw new ExpectedError(`Device ${params.uuid} is not online`);
			} else {
				throw e;
			}
		}
	}
}
