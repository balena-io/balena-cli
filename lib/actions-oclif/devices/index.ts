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
import { tryAsInteger } from '../../utils/validation';
import type { Device, Application } from 'balena-sdk';

interface ExtendedDevice extends Device {
	dashboard_url?: string;
	application_name?: string;
}

interface FlagsDef {
	application?: string;
	app?: string;
	help: void;
}

export default class DevicesCmd extends Command {
	public static description = stripIndent`
		List all devices.

		list all devices that belong to you.

		You can filter the devices by application by using the \`--application\` option.
	`;
	public static examples = [
		'$ balena devices',
		'$ balena devices --application MyApp',
		'$ balena devices --app MyApp',
		'$ balena devices -a MyApp',
	];

	public static usage = 'devices';

	public static flags: flags.Input<FlagsDef> = {
		application: cf.application,
		app: cf.app,
		help: cf.help,
	};

	public static primary = true;

	public static authenticated = true;

	public async run() {
		const { flags: options } = this.parse<FlagsDef, {}>(DevicesCmd);

		const balena = getBalenaSdk();

		// Consolidate application options
		options.application = options.application || options.app;
		delete options.app;

		let devices: ExtendedDevice[];

		if (options.application != null) {
			devices = await balena.models.device.getAllByApplication(
				tryAsInteger(options.application),
				expandForAppName,
			);
		} else {
			devices = await balena.models.device.getAll(expandForAppName);
		}

		devices = devices.map(function (device) {
			device.dashboard_url = balena.models.device.getDashboardUrl(device.uuid);

			const belongsToApplication = device.belongs_to__application as Application[];
			device.application_name = belongsToApplication?.[0]
				? belongsToApplication[0].app_name
				: 'N/a';

			device.uuid = device.uuid.slice(0, 7);
			return device;
		});

		console.log(
			getVisuals().table.horizontal(devices, [
				'id',
				'uuid',
				'device_name',
				'device_type',
				'application_name',
				'status',
				'is_online',
				'supervisor_version',
				'os_version',
				'dashboard_url',
			]),
		);
	}
}
