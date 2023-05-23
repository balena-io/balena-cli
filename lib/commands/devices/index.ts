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

import { flags } from '@oclif/command';
import Command from '../../command';
import * as cf from '../../utils/common-flags';
import { expandForAppName } from '../../utils/helpers';
import { getBalenaSdk, getVisuals, stripIndent } from '../../utils/lazy';
import { applicationIdInfo, jsonInfo } from '../../utils/messages';

import type { Application, Device, PineOptions } from 'balena-sdk';

interface ExtendedDevice extends DeviceWithDeviceType {
	dashboard_url?: string;
	fleet?: string | null; // 'org/name' slug
	device_type?: string | null;
}

interface FlagsDef {
	fleet?: string;
	help: void;
	json: boolean;
}

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

	public static flags: flags.Input<FlagsDef> = {
		fleet: cf.fleet,
		json: cf.json,
		help: cf.help,
	};

	public static primary = true;

	public static authenticated = true;

	public async run() {
		const { flags: options } = this.parse<FlagsDef, {}>(DevicesCmd);

		const balena = getBalenaSdk();
		const devicesOptions = {
			...devicesSelectFields,
			...expandForAppName,
			$orderby: { device_name: 'asc' },
		} satisfies PineOptions<Device>;

		let devices;

		if (options.fleet != null) {
			const { getApplication } = await import('../../utils/sdk');
			const application = await getApplication(balena, options.fleet);
			devices = (await balena.models.device.getAllByApplication(
				application.id,
				devicesOptions,
			)) as ExtendedDevice[];
		} else {
			devices = (await balena.pine.get({
				resource: 'device',
				options: devicesOptions,
			})) as ExtendedDevice[];
		}

		devices = devices.map(function (device) {
			device.dashboard_url = balena.models.device.getDashboardUrl(device.uuid);

			const belongsToApplication =
				device.belongs_to__application as Application[];
			device.fleet = belongsToApplication?.[0]?.slug || null;

			device.uuid = options.json ? device.uuid : device.uuid.slice(0, 7);

			device.device_type = device.is_of__device_type?.[0]?.slug || null;
			return device;
		});

		const fields = [
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
			const { pickAndRename } = await import('../../utils/helpers');
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
