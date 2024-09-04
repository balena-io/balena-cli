/**
 * @license
 * Copyright 2021 Balena Ltd.
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

import { Flags, Args } from '@oclif/core';
import Command from '../../command.js';
import * as cf from '../../utils/common-flags.js';
import { getBalenaSdk, stripIndent } from '../../utils/lazy.js';

export default class DeviceLocalModeCmd extends Command {
	public static description = stripIndent`
		Get or manage the local mode status for a device.

		Output current local mode status, or enable/disable local mode
		for specified device.
	`;

	public static examples = [
		'$ balena device local-mode 23c73a1',
		'$ balena device local-mode 23c73a1 --enable',
		'$ balena device local-mode 23c73a1 --disable',
		'$ balena device local-mode 23c73a1 --status',
	];

	public static args = {
		uuid: Args.string({
			description: 'the uuid of the device to manage',
			required: true,
		}),
	};

	public static usage = 'device local-mode <uuid>';

	public static flags = {
		enable: Flags.boolean({
			description: 'enable local mode',
			exclusive: ['disable', 'status'],
		}),
		disable: Flags.boolean({
			description: 'disable local mode',
			exclusive: ['enable', 'status'],
		}),
		status: Flags.boolean({
			description: 'output boolean indicating local mode status',
			exclusive: ['enable', 'disable'],
		}),
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } =
			await this.parse(DeviceLocalModeCmd);

		const balena = getBalenaSdk();

		if (options.enable) {
			await balena.models.device.enableLocalMode(params.uuid);
			console.log(`Local mode on device ${params.uuid} is now ENABLED.`);
		} else if (options.disable) {
			await balena.models.device.disableLocalMode(params.uuid);
			console.log(`Local mode on device ${params.uuid} is now DISABLED.`);
		} else if (options.status) {
			// Output bool indicating local mode status
			const isEnabled = await balena.models.device.isInLocalMode(params.uuid);
			console.log(isEnabled);
		} else {
			// If no flag provided, output status and tip
			const isEnabled = await balena.models.device.isInLocalMode(params.uuid);
			console.log(
				`Local mode on device ${params.uuid} is ${
					isEnabled ? 'ENABLED' : 'DISABLED'
				}.`,
			);
			if (isEnabled) {
				console.log('To disable, use:');
				console.log(`  balena device local-mode ${params.uuid} --disable`);
			} else {
				console.log('To enable, use:');
				console.log(`  balena device local-mode ${params.uuid} --enable`);
			}
		}
	}
}
