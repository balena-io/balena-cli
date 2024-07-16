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

import Command from '../../command.js';
import * as cf from '../../utils/common-flags.js';
import * as ca from '../../utils/common-args.js';
import { getBalenaSdk, stripIndent } from '../../utils/lazy.js';
import { applicationIdInfo } from '../../utils/messages.js';

export default class FleetRmCmd extends Command {
	public static description = stripIndent`
		Remove a fleet.

		Permanently remove a fleet.

		The --yes option may be used to avoid interactive confirmation.

		${applicationIdInfo.split('\n').join('\n\t\t')}
	`;

	public static examples = [
		'$ balena fleet rm MyFleet',
		'$ balena fleet rm MyFleet --yes',
		'$ balena fleet rm myorg/myfleet',
	];

	public static args = {
		fleet: ca.fleetRequired,
	};

	public static usage = 'fleet rm <fleet>';

	public static flags = {
		yes: cf.yes,
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(FleetRmCmd);

		const { confirm } = await import('../../utils/patterns.js');
		const { getApplication } = await import('../../utils/sdk.js');
		const balena = getBalenaSdk();

		// Confirm
		await confirm(
			options.yes ?? false,
			`Are you sure you want to delete fleet ${params.fleet}?`,
		);

		// Disambiguate application (if is a number, it could either be an ID or a numerical name)
		const application = await getApplication(balena, params.fleet, {
			$select: 'slug',
		});

		// Remove
		await balena.models.application.remove(application.slug);
	}
}
