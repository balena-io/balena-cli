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

import { Flags, Args, Command } from '@oclif/core';
import { ExpectedError } from '../../errors';
import * as cf from '../../utils/common-flags';
import { getBalenaSdk, getCliUx, stripIndent } from '../../utils/lazy';

export default class DeviceSupportCmd extends Command {
	public static description = stripIndent`
		Grant or revoke support access for devices.

		Grant or revoke balena support agent access to devices
		on balenaCloud. (This command does not apply to openBalena.)
		Access will be automatically revoked once the specified duration has elapsed.

		Duration defaults to 24h, but can be specified using --duration flag in days
		or hours, e.g. '12h', '2d'.

		Multiple values can specified as a comma-separated list (with no spaces).
	`;

	public static examples = [
		'balena support enable ab346f,cd457a --duration 3d',
		'balena support disable ab346f,cd457a',
	];

	public static args = {
		action: Args.string({
			description: 'enable|disable support access',
			options: ['enable', 'disable'],
			required: true,
		}),
		uuid: Args.string({
			description:
				'comma-separated list (no blank spaces) of device UUIDs to be moved',
			required: true,
		}),
	};

	public static flags = {
		duration: Flags.string({
			description:
				'length of time to enable support for, in (h)ours or (d)ays, e.g. 12h, 2d',
			char: 't',
		}),
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(DeviceSupportCmd);

		const balena = getBalenaSdk();
		const ux = getCliUx();

		const enabling = params.action === 'enable';

		if (options.duration != null && !enabling) {
			throw new ExpectedError(
				'--duration option is only applicable when enabling support',
			);
		}

		// Calculate expiry ts
		const durationDefault = '24h';
		const duration = options.duration || durationDefault;
		const { parseDuration } = await import('../../utils/helpers');
		const expiryTs = Date.now() + parseDuration(duration);

		const deviceUuids = params.uuid?.split(',') || [];

		const enablingMessage = 'Enabling support access for';
		const disablingMessage = 'Disabling support access for';

		// Process devices
		for (const deviceUuid of deviceUuids) {
			if (enabling) {
				ux.action.start(`${enablingMessage} device ${deviceUuid}`);
				await balena.models.device.grantSupportAccess(deviceUuid, expiryTs);
			} else if (params.action === 'disable') {
				ux.action.start(`${disablingMessage} device ${deviceUuid}`);
				await balena.models.device.revokeSupportAccess(deviceUuid);
			}
			ux.action.stop();
		}

		if (enabling) {
			console.log(
				`Access has been granted for ${duration}, expiring ${new Date(
					expiryTs,
				).toISOString()}`,
			);
		}
	}
}
