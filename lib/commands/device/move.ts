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

import type { flags } from '@oclif/command';
import type { IArg } from '@oclif/parser/lib/args';
import type {
	BalenaSDK,
	Device,
	DeviceType,
	PineOptions,
	PineTypedResult,
} from 'balena-sdk';
import Command from '../../command';
import * as cf from '../../utils/common-flags';
import { ExpectedError } from '../../errors';
import { getBalenaSdk, stripIndent } from '../../utils/lazy';
import { applicationIdInfo } from '../../utils/messages';

type ExtendedDevice = PineTypedResult<
	Device,
	typeof import('../../utils/helpers').expandForAppNameAndCpuArch
> & {
	application_name?: string;
};

interface FlagsDef {
	fleet?: string;
	help: void;
}

interface ArgsDef {
	uuid: string;
}

export default class DeviceMoveCmd extends Command {
	public static description = stripIndent`
		Move one or more devices to another fleet.

		Move one or more devices to another fleet.

		If --fleet is omitted, the fleet will be prompted for interactively.

		${applicationIdInfo.split('\n').join('\n\t\t')}
	`;

	public static examples = [
		'$ balena device move 7cf02a6',
		'$ balena device move 7cf02a6,dc39e52',
		'$ balena device move 7cf02a6 --fleet MyNewFleet',
		'$ balena device move 7cf02a6 -f myorg/mynewfleet',
	];

	public static args: Array<IArg<any>> = [
		{
			name: 'uuid',
			description:
				'comma-separated list (no blank spaces) of device UUIDs to be moved',
			required: true,
		},
	];

	public static usage = 'device move <uuid(s)>';

	public static flags: flags.Input<FlagsDef> = {
		fleet: cf.fleet,
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			DeviceMoveCmd,
		);

		const balena = getBalenaSdk();

		const { expandForAppNameAndCpuArch } = await import('../../utils/helpers');

		// Split uuids string into array of uuids
		const deviceUuids = params.uuid.split(',');

		// Get devices
		const devices = await Promise.all(
			deviceUuids.map(
				(uuid) =>
					balena.models.device.get(
						uuid,
						expandForAppNameAndCpuArch,
					) as Promise<ExtendedDevice>,
			),
		);

		// Map application name for each device
		for (const device of devices) {
			const belongsToApplication = device.belongs_to__application;
			device.application_name = belongsToApplication?.[0]
				? belongsToApplication[0].app_name
				: 'N/a';
		}

		// Disambiguate application
		const { getApplication } = await import('../../utils/sdk');

		// Get destination application
		const application = options.fleet
			? await getApplication(balena, options.fleet)
			: await this.interactivelySelectApplication(balena, devices);

		// Move each device
		for (const uuid of deviceUuids) {
			try {
				await balena.models.device.move(uuid, application.id);
				console.info(`Device ${uuid} was moved to fleet ${application.slug}`);
			} catch (err) {
				console.info(`${err.message}, uuid: ${uuid}`);
				process.exitCode = 1;
			}
		}
	}

	async interactivelySelectApplication(
		balena: BalenaSDK,
		devices: ExtendedDevice[],
	) {
		const { getExpandedProp } = await import('../../utils/pine');
		// deduplicate the slugs
		const deviceCpuArchs = Array.from(
			new Set(
				devices.map(
					(d) => d.is_of__device_type[0].is_of__cpu_architecture[0].slug,
				),
			),
		);

		const deviceTypeOptions = {
			$select: 'slug',
			$expand: {
				is_of__cpu_architecture: {
					$select: 'slug',
				},
			},
		} satisfies PineOptions<DeviceType>;
		const deviceTypes = (await balena.models.deviceType.getAllSupported(
			deviceTypeOptions,
		)) as Array<PineTypedResult<DeviceType, typeof deviceTypeOptions>>;

		const compatibleDeviceTypeSlugs = new Set(
			deviceTypes
				.filter((deviceType) => {
					const deviceTypeArch = getExpandedProp(
						deviceType.is_of__cpu_architecture,
						'slug',
					)!;
					return deviceCpuArchs.every((deviceCpuArch) =>
						balena.models.os.isArchitectureCompatibleWith(
							deviceCpuArch,
							deviceTypeArch,
						),
					);
				})
				.map((deviceType) => deviceType.slug),
		);

		const patterns = await import('../../utils/patterns');
		try {
			const application = await patterns.selectApplication(
				(app) =>
					compatibleDeviceTypeSlugs.has(app.is_for__device_type[0].slug) &&
					devices.some((device) => device.application_name !== app.app_name),
				true,
			);
			return application;
		} catch (err) {
			if (!compatibleDeviceTypeSlugs.size) {
				throw new ExpectedError(
					`${err.message}\nDo all devices have a compatible architecture?`,
				);
			}
			throw err;
		}
	}
}
