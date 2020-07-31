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
import type { IArg } from '@oclif/parser/lib/args';
import type { Application } from 'balena-sdk';
import Command from '../../command';
import * as cf from '../../utils/common-flags';
import { expandForAppName } from '../../utils/helpers';
import { getBalenaSdk, stripIndent } from '../../utils/lazy';
import { tryAsInteger } from '../../utils/validation';
import { ExpectedError } from '../../errors';

interface ExtendedDevice extends DeviceWithDeviceType {
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
		Move one or more devices to another application.

		Move one or more devices to another application.

		Note, if the application option is omitted it will be prompted
		for interactively.
		`;
	public static examples = [
		'$ balena device move 7cf02a6',
		'$ balena device move 7cf02a6,dc39e52',
		'$ balena device move 7cf02a6 --application MyNewApp',
	];

	public static args: Array<IArg<any>> = [
		{
			name: 'uuid',
			description:
				'comma-separated list (no blank spaces) of device UUIDs to be moved',
			parse: (dev) => tryAsInteger(dev),
			required: true,
		},
	];

	public static usage = 'device move <uuid(s)>';

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

		// Consolidate application options
		options.application = options.application || options.app;
		delete options.app;

		const devices = await Promise.all(
			params.uuid
				.split(',')
				.map(
					(uuid) =>
						balena.models.device.get(uuid, expandForAppName) as Promise<
							ExtendedDevice
						>,
				),
		);

		for (const device of devices) {
			const belongsToApplication = device.belongs_to__application as Application[];
			device.application_name = belongsToApplication?.[0]
				? belongsToApplication[0].app_name
				: 'N/a';
		}

		// Get destination application
		let application;
		if (options.application) {
			application = options.application;
		} else {
			const [deviceDeviceTypes, deviceTypes] = await Promise.all([
				Promise.all(
					devices.map((device) =>
						balena.models.device.getManifestBySlug(
							device.is_of__device_type[0].slug,
						),
					),
				),
				balena.models.config.getDeviceTypes(),
			]);

			const compatibleDeviceTypes = deviceTypes.filter((dt) =>
				deviceDeviceTypes.every(
					(deviceDeviceType) =>
						balena.models.os.isArchitectureCompatibleWith(
							deviceDeviceType.arch,
							dt.arch,
						) &&
						!!dt.isDependent === !!deviceDeviceType.isDependent &&
						dt.state !== 'DISCONTINUED',
				),
			);

			const patterns = await import('../../utils/patterns');
			try {
				application = await patterns.selectApplication(
					(app) =>
						compatibleDeviceTypes.some(
							(dt) => dt.slug === app.is_for__device_type[0].slug,
						) &&
						// @ts-ignore using the extended device object prop
						devices.some((device) => device.application_name !== app.app_name),
					true,
				);
			} catch (err) {
				if (deviceDeviceTypes.length) {
					throw new ExpectedError(
						`${err.message}\nDo all devices have a compatible architecture?`,
					);
				}
				throw err;
			}
		}

		for (const uuid of params.uuid.split(',')) {
			try {
				await balena.models.device.move(uuid, tryAsInteger(application));
				console.info(`${uuid} was moved to ${application}`);
			} catch (err) {
				console.info(`${err.message}, uuid: ${uuid}`);
				process.exitCode = 1;
			}
		}
	}
}
