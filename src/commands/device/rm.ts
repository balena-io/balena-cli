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
import { getBalenaSdk, stripIndent } from '../../utils/lazy.js';

export default class DeviceRmCmd extends Command {
	public static description = stripIndent`
		Remove one or more devices.

		Remove one or more devices from balena.

		Note this command asks for confirmation interactively.
		You can avoid this by passing the \`--yes\` option.
		`;
	public static examples = [
		'$ balena device rm 7cf02a6',
		'$ balena device rm 7cf02a6,dc39e52',
		'$ balena device rm 7cf02a6 --yes',
	];

	public static args = {
		uuid: Args.string({
			description:
				'comma-separated list (no blank spaces) of device UUIDs to be removed',
			required: true,
		}),
	};

	public static usage = 'device rm <uuid(s)>';

	public static flags = {
		yes: cf.yes,
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(DeviceRmCmd);

		const balena = getBalenaSdk();
		const patterns = await import('../../utils/patterns.js');

		// Confirm
		const uuids = params.uuid.split(',');
		await patterns.confirm(
			options.yes,
			uuids.length > 1
				? `Are you sure you want to delete ${uuids.length} devices?`
				: `Are you sure you want to delete device ${uuids[0]} ?`,
		);

		// Remove
		for (const uuid of uuids) {
			try {
				await balena.models.device.remove(uuid);
			} catch (err) {
				console.info(`${err.message}, uuid: ${uuid}`);
				process.exitCode = 1;
				continue;
			}
		}
	}
}
