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
import { applicationIdInfo } from '../../utils/messages';

export default class FleetSupportCmd extends Command {
	public static description = stripIndent`
		Grant or revoke support access for fleets.

		Grant or revoke balena support agent access to fleets
		on balenaCloud. (This command does not apply to openBalena.)
		Access will be automatically revoked once the specified duration has elapsed.

		Duration defaults to 24h, but can be specified using --duration flag in days
		or hours, e.g. '12h', '2d'.

		Multiple values can specified as a comma-separated list (with no spaces).

		${applicationIdInfo.split('\n').join('\n\t\t')}
	`;

	public static examples = [
		'balena support enable myorg/myfleet,notmyorg/notmyfleet --duration 3d',
		'balena support disable myorg/myfleet',
	];

	public static args = {
		action: Args.string({
			description: 'enable|disable support access',
			options: ['enable', 'disable'],
			required: true,
		}),
		fleet: Args.string({
			description:
				'comma-separated list (no spaces) of fleet names or slugs (preferred)',
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
		const { args: params, flags: options } = await this.parse(FleetSupportCmd);

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

		const appNames = params.fleet?.split(',') || [];

		const enablingMessage = 'Enabling support access for';
		const disablingMessage = 'Disabling support access for';

		const { getFleetSlug } = await import('../../utils/sdk');

		// Process applications
		for (const appName of appNames) {
			const slug = await getFleetSlug(balena, appName);
			if (enabling) {
				ux.action.start(`${enablingMessage} fleet ${slug}`);
				await balena.models.application.grantSupportAccess(slug, expiryTs);
			} else if (params.action === 'disable') {
				ux.action.start(`${disablingMessage} fleet ${slug}`);
				await balena.models.application.revokeSupportAccess(slug);
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
