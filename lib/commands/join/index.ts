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

import { Args, Flags } from '@oclif/core';
import Command from '../../command.js';
import * as cf from '../../utils/common-flags.js';
import { getBalenaSdk, stripIndent } from '../../utils/lazy.js';
import { applicationIdInfo } from '../../utils/messages.js';
import { parseAsLocalHostnameOrIp } from '../../utils/validation.js';

export default class JoinCmd extends Command {
	public static description = stripIndent`
		Move a local device to a fleet on another balena server.

		Move a local device to a fleet on another balena server, causing
		the device to "join" the new server. The device must be running balenaOS.

		For example, you could provision a device against an openBalena installation
		where you perform end-to-end tests and then move it to balenaCloud when it's
		ready for production.

		To move a device between fleets on the same server, use the
		\`balena device move\` command instead of \`balena join\`.

		If you don't specify a device hostname or IP, this command will automatically
		scan the local network for balenaOS devices and prompt you to select one
		from an interactive picker. This may require administrator/root privileges.
		Likewise, if the fleet option is not provided then a picker will be shown.

		${applicationIdInfo.split('\n').join('\n\t\t')}
	`;

	public static examples = [
		'$ balena join',
		'$ balena join balena.local',
		'$ balena join balena.local --fleet MyFleet',
		'$ balena join balena.local -f myorg/myfleet',
		'$ balena join 192.168.1.25',
		'$ balena join 192.168.1.25 --fleet MyFleet',
	];

	public static args = {
		deviceIpOrHostname: Args.string({
			description: 'the IP or hostname of device',
			parse: parseAsLocalHostnameOrIp,
		}),
	};

	// Hardcoded to preserve camelcase
	public static usage = 'join [deviceIpOrHostname]';

	public static flags = {
		fleet: cf.fleet,
		pollInterval: Flags.integer({
			description: 'the interval in minutes to check for updates',
			char: 'i',
		}),
		help: cf.help,
	};

	public static authenticated = true;
	public static primary = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(JoinCmd);

		const promote = await import('../../utils/promote.js');
		const sdk = getBalenaSdk();
		const logger = await Command.getLogger();
		return promote.join(
			logger,
			sdk,
			params.deviceIpOrHostname,
			options.fleet,
			options.pollInterval,
		);
	}
}
