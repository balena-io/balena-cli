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
import { getBalenaSdk, getCliUx, stripIndent } from '../../utils/lazy.js';

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

	public static args = {
		uuid: Args.string({
			description: 'comma-separated list (no blank spaces) of device UUIDs',
			required: true,
		}),
	};

	public static flags = {
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = await this.parse(DevicePurgeCmd);

		const balena = getBalenaSdk();
		const ux = getCliUx();

		const deviceUuids = params.uuid.split(',');

		for (const uuid of deviceUuids) {
			ux.action.start(`Purging data from device ${uuid}`);
			await balena.models.device.purge(uuid);
			ux.action.stop();
		}
	}
}
