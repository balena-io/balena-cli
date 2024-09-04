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

import { Flags, Args } from '@oclif/core';
import Command from '../../command.js';
import * as cf from '../../utils/common-flags.js';
import { expandForAppName } from '../../utils/helpers.js';
import { getBalenaSdk, getVisuals, stripIndent } from '../../utils/lazy.js';
import { jsonInfo } from '../../utils/messages.js';

import type { Application, Release } from 'balena-sdk';

interface ExtendedDevice extends DeviceWithDeviceType {
	dashboard_url?: string;
	fleet: string; // 'org/name' slug
	device_type?: string;
	commit?: string;
	last_seen?: string;
	memory_usage_mb: number | null;
	memory_total_mb: number | null;
	memory_usage_percent?: number;
	storage_usage_mb: number | null;
	storage_total_mb: number | null;
	storage_usage_percent?: number;
	cpu_temp_c: number | null;
	cpu_usage_percent: number | null;
	undervoltage_detected?: boolean;
}

export default class DeviceCmd extends Command {
	public static description = stripIndent`
		Show info about a single device.

		Show information about a single device.

		${jsonInfo.split('\n').join('\n\t\t')}
		`;
	public static examples = [
		'$ balena device 7cf02a6',
		'$ balena device 7cf02a6 --view',
		'$ balena device 7cf02a6 --json',
	];

	public static args = {
		uuid: Args.string({
			description: 'the device uuid',
			required: true,
		}),
	};

	public static usage = 'device <uuid>';

	public static flags = {
		json: cf.json,
		help: cf.help,
		view: Flags.boolean({
			default: false,
			description: 'open device dashboard page',
		}),
	};

	public static authenticated = true;
	public static primary = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(DeviceCmd);

		const balena = getBalenaSdk();

		const device = (await balena.models.device.get(
			params.uuid,
			options.json
				? {
						$expand: {
							device_tag: {
								$select: ['tag_key', 'value'],
							},
							...expandForAppName.$expand,
						},
					}
				: {
						$select: [
							'device_name',
							'id',
							'overall_status',
							'is_online',
							'ip_address',
							'mac_address',
							'last_connectivity_event',
							'uuid',
							'supervisor_version',
							'is_web_accessible',
							'note',
							'os_version',
							'memory_usage',
							'memory_total',
							'public_address',
							'storage_block_device',
							'storage_usage',
							'storage_total',
							'cpu_usage',
							'cpu_temp',
							'cpu_id',
							'is_undervolted',
						],
						...expandForAppName,
					},
		)) as ExtendedDevice;

		if (options.view) {
			const { default: open } = await import('open');
			const dashboardUrl = balena.models.device.getDashboardUrl(device.uuid);
			await open(dashboardUrl, { wait: false });
			return;
		}

		device.status = device.overall_status;

		device.dashboard_url = balena.models.device.getDashboardUrl(device.uuid);

		const belongsToApplication =
			device.belongs_to__application as Application[];
		device.fleet = belongsToApplication?.[0]
			? belongsToApplication[0].slug
			: 'N/a';

		device.device_type = device.is_of__device_type[0].slug;

		const isRunningRelease = device.is_running__release as Release[];
		device.commit = isRunningRelease?.[0] ? isRunningRelease[0].commit : 'N/a';

		device.last_seen = device.last_connectivity_event ?? undefined;

		// Memory/Storage are really MiB
		// Consider changing headings to MiB once we can do lowercase

		device.memory_usage_mb = device.memory_usage;
		device.memory_total_mb = device.memory_total;

		device.storage_usage_mb = device.storage_usage;
		device.storage_total_mb = device.storage_total;

		device.cpu_temp_c = device.cpu_temp;
		device.cpu_usage_percent = device.cpu_usage;

		// Only show undervoltage status if true
		// API sends false even for devices which are not detecting this.
		if (device.is_undervolted) {
			device.undervoltage_detected = device.is_undervolted;
		}

		if (
			device.memory_usage != null &&
			device.memory_total != null &&
			device.memory_total !== 0
		) {
			device.memory_usage_percent = Math.round(
				(device.memory_usage / device.memory_total) * 100,
			);
		}

		if (
			device.storage_usage != null &&
			device.storage_total != null &&
			device.storage_total !== 0
		) {
			device.storage_usage_percent = Math.round(
				(device.storage_usage / device.storage_total) * 100,
			);
		}

		if (options.json) {
			console.log(JSON.stringify(device, null, 4));
			return;
		}

		console.log(
			getVisuals().table.vertical(device, [
				`$${device.device_name}$`,
				'id',
				'device_type',
				'status',
				'is_online',
				'ip_address',
				'public_address',
				'mac_address',
				'fleet',
				'last_seen',
				'uuid',
				'commit',
				'supervisor_version',
				'is_web_accessible',
				'note',
				'os_version',
				'dashboard_url',
				'cpu_usage_percent',
				'cpu_temp_c',
				'cpu_id',
				'memory_usage_mb',
				'memory_total_mb',
				'memory_usage_percent',
				'storage_block_device',
				'storage_usage_mb',
				'storage_total_mb',
				'storage_usage_percent',
				'undervoltage_detected',
			]),
		);
	}
}
