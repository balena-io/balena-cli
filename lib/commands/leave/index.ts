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
import { stripIndent } from '../../utils/lazy.js';
import { parseAsLocalHostnameOrIp } from '../../utils/validation.js';

export default class LeaveCmd extends Command {
	public static description = stripIndent`
		Remove a local device from its balena fleet.

		Remove a local device from its balena fleet, causing the device to
		"leave" the server it is provisioned on. This effectively makes the device
		"unmanaged". The device must be running balenaOS.

		The device entry on the server is preserved after running this command,
		so the device can subsequently re-join the server if needed.

		If you don't specify a device hostname or IP, this command will automatically
		scan the local network for balenaOS devices and prompt you to select one
		from an interactive picker. This may require administrator/root privileges.
	`;

	public static examples = [
		'$ balena leave',
		'$ balena leave balena.local',
		'$ balena leave 192.168.1.25',
	];

	public static args = {
		deviceIpOrHostname: Args.string({
			description: 'the device IP or hostname',
			parse: parseAsLocalHostnameOrIp,
		}),
	};

	public static usage = 'leave [deviceIpOrHostname]';

	public static flags = {
		help: cf.help,
	};

	public static authenticated = true;
	public static primary = true;

	public async run() {
		const { args: params } = await this.parse(LeaveCmd);

		const promote = await import('../../utils/promote.js');
		const logger = await Command.getLogger();
		return promote.leave(logger, params.deviceIpOrHostname);
	}
}
