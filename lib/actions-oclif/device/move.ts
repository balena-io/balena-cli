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
import { IArg } from '@oclif/parser/lib/args';
import { Application, Device } from 'balena-sdk';
import { stripIndent } from 'common-tags';
import * as _ from 'lodash';
import Command from '../../command';
import * as cf from '../../utils/common-flags';
import { expandForAppName } from '../../utils/helpers';
import { getBalenaSdk } from '../../utils/lazy';
import { tryAsInteger } from '../../utils/validation';

interface ExtendedDevice extends Device {
	application_name?: string;
}

interface FlagsDef {
	application?: string;
	app?: string;
	help: void;
}

interface ArgsDef {
	uuid: string;
}

export default class DeviceMoveCmd extends Command {
	public static description = stripIndent`
		Move a device to another application.

		Move a device to another application.

		Note, if the application option is omitted it will be prompted
		for interactively.
		`;
	public static examples = [
		'$ balena device move 7cf02a6',
		'$ balena device move 7cf02a6 --application MyNewApp',
	];

	public static args: Array<IArg<any>> = [
		{
			name: 'uuid',
			description: 'the uuid of the device to move',
			parse: (dev) => tryAsInteger(dev),
			required: true,
		},
	];

	public static usage = 'device move <uuid>';

	public static flags: flags.Input<FlagsDef> = {
		application: cf.application,
		app: cf.app,
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			DeviceMoveCmd,
		);

		const balena = getBalenaSdk();
		const patterns = await import('../../utils/patterns');

		// Consolidate application options
		options.application = options.application || options.app;
		delete options.app;

		const device: ExtendedDevice = await balena.models.device.get(
			params.uuid,
			expandForAppName,
		);

		const belongsToApplication = device.belongs_to__application as Application[];
		device.application_name = belongsToApplication?.[0]
			? belongsToApplication[0].app_name
			: 'N/a';

		// Get destination application
		let application;
		if (options.application) {
			application = options.application;
		} else {
			const [deviceDeviceType, deviceTypes] = await Promise.all([
				balena.models.device.getManifestBySlug(device.device_type),
				balena.models.config.getDeviceTypes(),
			]);

			const compatibleDeviceTypes = deviceTypes.filter(
				(dt) =>
					balena.models.os.isArchitectureCompatibleWith(
						deviceDeviceType.arch,
						dt.arch,
					) &&
					!!dt.isDependent === !!deviceDeviceType.isDependent &&
					dt.state !== 'DISCONTINUED',
			);

			application = await patterns.selectApplication((app: Application) =>
				_.every([
					_.some(compatibleDeviceTypes, (dt) => dt.slug === app.device_type),
					// @ts-ignore using the extended device object prop
					device.application_name !== app.app_name,
				]),
			);
		}

		await balena.models.device.move(params.uuid, tryAsInteger(application));

		console.info(`${params.uuid} was moved to ${application}`);
	}
}
