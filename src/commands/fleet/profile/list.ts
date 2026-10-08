/**
 * @license
 * Copyright 2026 Balena Ltd.
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

import { Command } from '@oclif/core';
import * as ca from '../../../utils/common-args';
import { getBalenaSdk, getVisuals, stripIndent } from '../../../utils/lazy';
import { applicationIdInfo } from '../../../utils/messages';

export default class FleetProfileListCmd extends Command {
	public static enableJsonFlag = true;
	public static description = stripIndent`
		List the OS profiles available to a fleet.

		List the OS profiles available to a fleet, grouped by the OS (host)
		application they belong to. The OS applications are the ones the devices of
		the fleet are operated by: usually a single one, but fleets with devices of
		multiple device types can run several. Fleets without devices therefore
		have no profiles listed.

		For each profile, whether it is activated for the fleet and its
		description are shown.

		The listed profile names can be used with the \`fleet profile activate\`,
		\`fleet profile deactivate\` and \`device profile\` commands.

		${applicationIdInfo.split('\n').join('\n\t\t')}
	`;

	public static examples = [
		'$ balena fleet profile list myorg/myfleet',
		'$ balena fleet profile list 1234567 --json',
	];

	public static args = {
		fleet: ca.fleetOrIdRequired,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } =
			await this.parse(FleetProfileListCmd);

		const balena = getBalenaSdk();
		const { getApplication, getHostApps } = await import('../../../utils/sdk');
		const { getProfileModels } = await import('../../../utils/profiles');

		const fleet = await getApplication(balena, params.fleet, {
			$select: ['id', 'slug'],
		});
		const { application } = getProfileModels(balena);
		const hostApps = await getHostApps(balena, fleet.id);
		const [catalogs, activations] = await Promise.all([
			Promise.all(
				hostApps.map((hostApp) =>
					application.profile.getCatalog(hostApp.id, {
						$select: ['catalogs__profile_name', 'description'],
						$orderby: { catalogs__profile_name: 'asc' },
					}),
				),
			),
			application.profile.getAllByApplication(fleet.id, {
				$select: ['activates__profile_name', 'on__application'],
			}),
		]);

		const groups = hostApps.map((hostApp, i) => ({
			os_application: { id: hostApp.id, slug: hostApp.slug },
			profiles: catalogs[i].map((entry) => ({
				profile: entry.catalogs__profile_name,
				is_active: activations.some(
					(a) =>
						a.activates__profile_name === entry.catalogs__profile_name &&
						a.on__application.__id === hostApp.id,
				),
				description: entry.description,
			})),
		}));

		if (options.json) {
			return JSON.stringify(groups, null, 4);
		}

		if (groups.length === 0) {
			console.log(
				`No devices of fleet ${fleet.slug} are operated by an OS application`,
			);
			return;
		}

		const visuals = getVisuals();
		const output = groups.map(({ os_application, profiles }) => {
			const title = `== ${os_application.slug}`;
			if (profiles.length === 0) {
				return `${title}\nNo profiles available`;
			}
			const rows = profiles.map((p) => ({
				profile: p.profile,
				active: p.is_active ? 'yes' : 'no',
				description: p.description ?? '',
			}));
			return `${title}\n${visuals.table.horizontal(rows, [
				'profile',
				'active',
				'description',
			])}`;
		});
		console.log(output.join('\n\n'));
	}
}
