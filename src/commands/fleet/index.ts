/**
 * @license
 * Copyright 2016-2021 Balena Ltd.
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

import { Flags, Command } from '@oclif/core';
import * as ca from '../../utils/common-args';
import { getBalenaSdk, getVisuals, stripIndent } from '../../utils/lazy';
import { applicationIdInfo } from '../../utils/messages';

export default class FleetCmd extends Command {
	public static enableJsonFlag = true;
	public static description = stripIndent`
		Display information about a single fleet.

		Display detailed information about a single fleet.

		${applicationIdInfo.split('\n').join('\n\t\t')}
`;
	public static examples = [
		'$ balena fleet MyFleet',
		'$ balena fleet myorg/myfleet',
		'$ balena fleet myorg/myfleet --view',
	];

	public static args = {
		fleet: ca.fleetRequired,
	};

	public static flags = {
		view: Flags.boolean({
			default: false,
			description: 'open fleet dashboard page',
		}),
	};

	public static authenticated = true;
	public static primary = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(FleetCmd);

		const { getApplication } = await import('../../utils/sdk');

		const balena = getBalenaSdk();

		const application = await getApplication(balena, params.fleet, {
			$expand: {
				is_for__device_type: { $select: 'slug' },
				should_be_running__release: { $select: 'commit' },
			},
		});

		if (options.view) {
			const open = await import('open');
			const dashboardUrl = balena.models.application.getDashboardUrl(
				application.id,
			);
			await open(dashboardUrl, { wait: false });
			return;
		}

		const applicationToDisplay = {
			id: application.id,
			app_name: application.app_name,
			slug: application.slug,
			device_type: application.is_for__device_type[0].slug,
			commit: application.should_be_running__release[0]?.commit,
		};

		if (options.json) {
			return JSON.stringify(applicationToDisplay, null, 4);
		}

		// Emulate table.vertical title output, but avoid uppercasing and inserting spaces
		console.log(`== ${applicationToDisplay.app_name}`);
		console.log(
			getVisuals().table.vertical(applicationToDisplay, [
				'id',
				'device_type',
				'slug',
				'commit',
			]),
		);
	}
}
