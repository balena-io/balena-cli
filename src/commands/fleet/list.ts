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

import { getBalenaSdk, getVisuals, stripIndent } from '../../utils/lazy.js';
import { Command } from '@oclif/core';

export default class FleetListCmd extends Command {
	public static enableJsonFlag = true;

	public static description = stripIndent`
		List all fleets.

		List all your balena fleets.

		For detailed information on a particular fleet, use
		\`balena fleet <fleet>\`
	`;

	public static examples = ['$ balena fleet list'];

	public static authenticated = true;
	public static primary = true;

	public async run() {
		const { flags: options } = await this.parse(FleetListCmd);

		const balena = getBalenaSdk();
		// Get applications
		const applications =
			await balena.models.application.getAllDirectlyAccessible({
				$select: ['id', 'app_name', 'slug'],
				$expand: {
					is_for__device_type: { $select: 'slug' },
					owns__device: { $select: 'is_online' },
				},
			});

		// Add extended properties
		const extendedApplications = applications.map((application) => ({
			...application,
			device_count: application.owns__device?.length ?? 0,
			online_devices:
				application.owns__device?.filter((d) => d.is_online).length || 0,
			device_type: application.is_for__device_type[0].slug,
		}));

		const applicationsToDisplay = extendedApplications.map((application) => ({
			id: application.id,
			app_name: application.app_name,
			slug: application.slug,
			device_type: application.device_type,
			online_devices: application.online_devices,
			device_count: application.device_count,
		}));

		if (options.json) {
			return JSON.stringify(applicationsToDisplay, null, 4);
		}

		console.log(
			getVisuals().table.horizontal(applicationsToDisplay, [
				'id',
				'app_name => NAME',
				'slug',
				'device_type',
				'device_count',
				'online_devices',
			]),
		);
	}
}
