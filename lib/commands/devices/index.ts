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
import type { Application } from 'balena-sdk';

interface ExtendedDevice extends DeviceWithDeviceType {
	dashboard_url?: string;
	application_name?: string | null;
	device_type?: string | null;
}

interface FlagsDef {
	application?: string;
	app?: string;
	help: void;
	json: boolean;
}

export default class DevicesCmd extends Command {
	public static description = stripIndent`
		List all devices.

		list all devices that belong to you.

		You can filter the devices by application by using the \`--application\` option.

		${applicationIdInfo.split('\n').join('\n\t\t')}

		${jsonInfo.split('\n').join('\n\t\t')}
	`;
	public static examples = [
		'$ balena devices',
		'$ balena devices --application MyApp',
		'$ balena devices --app MyApp',
		'$ balena devices -a MyApp',
		'$ balena devices -a myorg/myapp',
	];

	public static usage = 'devices';

	public static flags: flags.Input<FlagsDef> = {
		application: cf.application,
		app: cf.app,
		json: cf.json,
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

		let devices;

		if (options.application != null) {
			const { getApplication } = await import('../../utils/sdk');
			const application = await getApplication(balena, options.application);
			devices = (await balena.models.device.getAllByApplication(
				application.id,
				expandForAppName,
			)) as ExtendedDevice[];
		} else {
			devices = (await balena.models.device.getAll(
				expandForAppName,
			)) as ExtendedDevice[];
		}

		devices = devices.map(function (device) {
			device.dashboard_url = balena.models.device.getDashboardUrl(device.uuid);

			const belongsToApplication = device.belongs_to__application as Application[];
			device.application_name = belongsToApplication?.[0]?.app_name || null;

			device.uuid = options.json ? device.uuid : device.uuid.slice(0, 7);

			device.device_type = device.is_of__device_type?.[0]?.slug || null;
			return device;
		});

		const fields = [
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
		];
		const _ = await import('lodash');
		if (options.json) {
			console.log(
				JSON.stringify(
					devices.map((device) => _.pick(device, fields)),
					null,
					4,
				),
			);
		} else {
			console.log(
				getVisuals().table.horizontal(
					devices.map((dev) => _.mapValues(dev, (val) => val ?? 'N/a')),
					fields,
				),
			);
		}
	}
}
