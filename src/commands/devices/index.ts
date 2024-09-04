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
import { expandForAppName } from '../../utils/helpers.js';
import { getBalenaSdk, getVisuals, stripIndent } from '../../utils/lazy.js';
import { applicationIdInfo, jsonInfo } from '../../utils/messages.js';

import type { Device, PineOptions } from 'balena-sdk';

const devicesSelectFields = {
	$select: [
		'id',
		'uuid',
		'device_name',
		'status',
		'is_online',
		'supervisor_version',
		'os_version',
	],
} satisfies PineOptions<Device>;

export default class DevicesCmd extends Command {
	public static description = stripIndent`
		List all devices.

		List all of your devices.

		Devices can be filtered by fleet with the \`--fleet\` option.

		${applicationIdInfo.split('\n').join('\n\t\t')}

		${jsonInfo.split('\n').join('\n\t\t')}
	`;
	public static examples = [
		'$ balena devices',
		'$ balena devices --fleet MyFleet',
		'$ balena devices -f myorg/myfleet',
	];

	public static usage = 'devices';

	public static flags = {
		fleet: cf.fleet,
		json: cf.json,
		help: cf.help,
	};

	public static primary = true;

	public static authenticated = true;

	public async run() {
		const { flags: options } = await this.parse(DevicesCmd);

		const balena = getBalenaSdk();
		const devicesOptions = {
			...devicesSelectFields,
			...expandForAppName,
			$orderby: { device_name: 'asc' },
		} satisfies PineOptions<Device>;

		const devices = (
			await (async () => {
				if (options.fleet != null) {
					const { getApplication } = await import('../../utils/sdk.js');
					const application = await getApplication(balena, options.fleet, {
						$select: 'slug',
						$expand: {
							owns__device: devicesOptions,
						},
					});
					return application.owns__device;
				}

				return await balena.pine.get({
					resource: 'device',
					options: devicesOptions,
				});
			})()
		).map((device) => ({
			...device,
			dashboard_url: balena.models.device.getDashboardUrl(device.uuid),
			fleet: device.belongs_to__application?.[0]?.slug || null,
			uuid: options.json ? device.uuid : device.uuid.slice(0, 7),
			device_type: device.is_of__device_type?.[0]?.slug || null,
		}));

		const fields: Array<keyof (typeof devices)[number]> = [
			'id',
			'uuid',
			'device_name',
			'device_type',
			'fleet',
			'status',
			'is_online',
			'supervisor_version',
			'os_version',
			'dashboard_url',
		];

		if (options.json) {
			const { pickAndRename } = await import('../../utils/helpers.js');
			const mapped = devices.map((device) => pickAndRename(device, fields));
			console.log(JSON.stringify(mapped, null, 4));
		} else {
			const _ = await import('lodash');
			console.log(
				getVisuals().table.horizontal(
					devices.map((dev) => _.mapValues(dev, (val) => val ?? 'N/a')),
					fields,
				),
			);
		}
	}
}
