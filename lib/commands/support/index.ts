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

import { Flags, Args } from '@oclif/core';
import Command from '../../command.js';
import { ExpectedError } from '../../errors.js';
import * as cf from '../../utils/common-flags.js';
import { getBalenaSdk, getCliUx, stripIndent } from '../../utils/lazy.js';
import { applicationIdInfo } from '../../utils/messages.js';

export default class SupportCmd extends Command {
	public static description = stripIndent`
		Grant or revoke support access for devices or fleets.

		Grant or revoke balena support agent access to devices or fleets
		on balenaCloud. (This command does not apply to openBalena.)
		Access will be automatically revoked once the specified duration has elapsed.

		Duration defaults to 24h, but can be specified using --duration flag in days
		or hours, e.g. '12h', '2d'.

		Both --device and --fleet flags accept multiple values, specified as
		a comma-separated list (with no spaces).

		${applicationIdInfo.split('\n').join('\n\t\t')}
	`;

	public static examples = [
		'balena support enable --device ab346f,cd457a --duration 3d',
		'balena support enable --fleet myFleet --duration 12h',
		'balena support disable -f myorg/myfleet',
	];

	public static args = {
		action: Args.string({
			description: 'enable|disable support access',
			options: ['enable', 'disable'],
		}),
	};

	public static usage = 'support <action>';

	public static flags = {
		device: Flags.string({
			description: 'comma-separated list (no spaces) of device UUIDs',
			char: 'd',
		}),
		fleet: {
			...cf.fleet,
			description:
				'comma-separated list (no spaces) of fleet names or slugs (preferred)',
		},
		duration: Flags.string({
			description:
				'length of time to enable support for, in (h)ours or (d)ays, e.g. 12h, 2d',
			char: 't',
		}),
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(SupportCmd);

		const balena = getBalenaSdk();
		const ux = getCliUx();

		const enabling = params.action === 'enable';

		// Validation
		if (!options.device && !options.fleet) {
			throw new ExpectedError('At least one device or fleet must be specified');
		}

		if (options.duration != null && !enabling) {
			throw new ExpectedError(
				'--duration option is only applicable when enabling support',
			);
		}

		// Calculate expiry ts
		const durationDefault = '24h';
		const duration = options.duration || durationDefault;
		const expiryTs = Date.now() + this.parseDuration(duration);

		const deviceUuids = options.device?.split(',') || [];
		const appNames = options.fleet?.split(',') || [];

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

		const { getFleetSlug } = await import('../../utils/sdk.js');

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

	parseDuration(duration: string): number {
		const parseErrorMsg =
			'Duration must be specified as number followed by h or d, e.g. 24h, 1d';
		const unit = duration.slice(duration.length - 1);
		const amount = Number(duration.substring(0, duration.length - 1));

		if (isNaN(amount)) {
			throw new ExpectedError(parseErrorMsg);
		}

		let durationMs;
		if (['h', 'H'].includes(unit)) {
			durationMs = amount * 60 * 60 * 1000;
		} else if (['d', 'D'].includes(unit)) {
			durationMs = amount * 24 * 60 * 60 * 1000;
		} else {
			throw new ExpectedError(parseErrorMsg);
		}

		return durationMs;
	}
}
