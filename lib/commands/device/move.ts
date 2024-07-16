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

import { Args } from '@oclif/core';
import type {
	BalenaSDK,
	Device,
	PineOptions,
	PineTypedResult,
} from 'balena-sdk';
import Command from '../../command.js';
import * as cf from '../../utils/common-flags.js';
import { ExpectedError } from '../../errors.js';
import { getBalenaSdk, stripIndent } from '../../utils/lazy.js';
import { applicationIdInfo } from '../../utils/messages.js';

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

	public static args = {
		uuid: Args.string({
			description:
				'comma-separated list (no blank spaces) of device UUIDs to be moved',
			required: true,
		}),
	};

	public static usage = 'device move <uuid(s)>';

	public static flags = {
		fleet: cf.fleet,
		help: cf.help,
	};

	public static authenticated = true;

	private async getDevices(balena: BalenaSDK, deviceUuids: string[]) {
		const deviceOptions = {
			$select: 'belongs_to__application',
			$expand: {
				is_of__device_type: {
					$select: 'is_of__cpu_architecture',
					$expand: {
						is_of__cpu_architecture: {
							$select: 'slug',
						},
					},
				},
			},
		} satisfies PineOptions<Device>;

		// TODO: Refacor once `device.get()` accepts an array of uuids`
		const devices = await Promise.all(
			deviceUuids.map(
				(uuid) =>
					balena.models.device.get(uuid, deviceOptions) as Promise<
						PineTypedResult<Device, typeof deviceOptions>
					>,
			),
		);
		return devices;
	}

	public async run() {
		const { args: params, flags: options } = await this.parse(DeviceMoveCmd);

		const balena = getBalenaSdk();

		// Split uuids string into array of uuids
		const deviceUuids = params.uuid.split(',');

		const devices = await this.getDevices(balena, deviceUuids);

		// Disambiguate application
		const { getApplication } = await import('../../utils/sdk.js');

		// Get destination application
		const application = options.fleet
			? await getApplication(balena, options.fleet, { $select: ['id', 'slug'] })
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
		devices: Awaited<ReturnType<typeof this.getDevices>>,
	) {
		// deduplicate the slugs
		const deviceCpuArchs = Array.from(
			new Set(
				devices.map(
					(d) => d.is_of__device_type[0].is_of__cpu_architecture[0].slug,
				),
			),
		);

		const allCpuArches = await balena.pine.get({
			resource: 'cpu_architecture',
			options: {
				$select: ['id', 'slug'],
			},
		});

		const compatibleCpuArchIds = allCpuArches
			.filter((cpuArch) => {
				return deviceCpuArchs.every((deviceCpuArch) =>
					balena.models.os.isArchitectureCompatibleWith(
						deviceCpuArch,
						cpuArch.slug,
					),
				);
			})
			.map((deviceType) => deviceType.id);

		const patterns = await import('../../utils/patterns.js');
		try {
			const application = await patterns.selectApplication(
				{
					is_for__device_type: {
						$any: {
							$alias: 'dt',
							$expr: {
								dt: {
									is_of__cpu_architecture: { $in: compatibleCpuArchIds },
								},
							},
						},
					},
				},
				true,
			);
			return application;
		} catch (err) {
			if (!compatibleCpuArchIds.length) {
				throw new ExpectedError(
					`${err.message}\nDo all devices have a compatible architecture?`,
				);
			}
			throw err;
		}
	}
}
