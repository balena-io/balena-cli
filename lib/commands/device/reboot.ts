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

export default class DeviceRebootCmd extends Command {
	public static description = stripIndent`
		Restart a device.

		Remotely reboot a device.
		`;
	public static examples = ['$ balena device reboot 23c73a1'];

	public static args = {
		uuid: Args.string({
			description: 'the uuid of the device to reboot',
			required: true,
		}),
	};

	public static usage = 'device reboot <uuid>';

	public static flags = {
		force: cf.force,
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(DeviceRebootCmd);

		const balena = getBalenaSdk();

		// The SDK current throws "BalenaDeviceNotFound: Device not found: xxxxx"
		// when the device is not online, which may be confusing.
		// https://github.com/balena-io/balena-cli/issues/1872
		await balena.models.device.reboot(params.uuid, options);
	}
}
