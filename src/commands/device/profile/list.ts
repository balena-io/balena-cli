/**
 * @license
 * Copyright 2026 Balena Ltd.
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

import { Args, Command } from '@oclif/core';
import { getBalenaSdk, getVisuals, stripIndent } from '../../../utils/lazy';

export default class DeviceProfileListCmd extends Command {
	public static enableJsonFlag = true;
	public static description = stripIndent`
		List the OS profiles available to a device.

		List the OS profiles available for the OS application a device is
		currently operated by. For each profile, the following are shown:
		- min_version: the earliest OS version that provides the profile
		- in_current_os: whether the OS release the device should be running provides it
		- fleet: whether the profile is activated for the device's fleet
		- override: the device override for the profile, if any
		- effective: the resulting state for the device (the override, if any,
		  otherwise the fleet setting)

		The listed profile names can be used with the \`device profile activate\`,
		\`device profile deactivate\` and \`device profile remove-override\` commands.
	`;

	public static examples = [
		'$ balena device profile list 23c73a1',
		'$ balena device profile list 23c73a1 --json',
	];

	public static args = {
		uuid: Args.string({
			description: 'the device uuid',
			required: true,
		}),
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } =
			await this.parse(DeviceProfileListCmd);

		const { ExpectedError } = await import('../../../errors');
		const { getProfileModels } = await import('../../../utils/profiles');
		const { getDevice } = await import('../../../utils/sdk');

		const device = await getDevice(params.uuid, {
			$select: ['id', 'uuid', 'belongs_to__application'],
			$expand: {
				should_be_operated_by__release: {
					$select: 'id',
					$expand: { belongs_to__application: { $select: ['id', 'slug'] } },
				},
			},
		});
		const fleetId = device.belongs_to__application?.__id;
		const osRelease = device.should_be_operated_by__release[0];
		const hostApp = osRelease?.belongs_to__application[0];
		if (fleetId == null || osRelease == null || hostApp == null) {
			throw new ExpectedError(
				`Device ${device.uuid} is not operated by any OS release, so no OS profiles are available to it`,
			);
		}

		const models = getProfileModels(getBalenaSdk());
		const [catalog, osReleaseProfiles, activations, overrides] =
			await Promise.all([
				models.application.profile.getCatalog(hostApp.id, {
					$select: ['catalogs__profile_name', 'description'],
					// The earliest successful release carrying the profile
					$expand: { available_since__release: { $select: 'raw_version' } },
					$orderby: { catalogs__profile_name: 'asc' },
				}),
				models.release.profile.getAllByRelease(osRelease.id, {
					$select: 'profile_name',
				}),
				models.application.profile.getAllByApplication(fleetId, {
					$select: 'activates__profile_name',
					$filter: { on__application: hostApp.id },
				}),
				models.device.profile.getAllByDevice(device.id, {
					$select: ['overrides__profile_name', 'is_active'],
					$filter: { on__application: hostApp.id },
				}),
			]);

		const inCurrentOs = new Set(osReleaseProfiles.map((p) => p.profile_name));
		const fleetActive = new Set(
			activations.map((a) => a.activates__profile_name),
		);
		const rows = catalog.map((entry) => {
			const name = entry.catalogs__profile_name;
			const override =
				overrides.find((o) => o.overrides__profile_name === name)?.is_active ??
				null;
			const fleet = fleetActive.has(name);
			return {
				profile: name,
				description: entry.description,
				min_version: entry.available_since__release[0]?.raw_version ?? null,
				in_current_os: inCurrentOs.has(name),
				fleet,
				override,
				// The device override, if any, otherwise the fleet setting
				effective: override ?? fleet,
			};
		});

		if (options.json) {
			return JSON.stringify(
				{
					os_application: { id: hostApp.id, slug: hostApp.slug },
					profiles: rows,
				},
				null,
				4,
			);
		}

		console.log(`== ${hostApp.slug}`);
		if (rows.length === 0) {
			console.log('No profiles available');
			return;
		}
		const onOff = (value: boolean) => (value ? 'on' : 'off');
		console.log(
			getVisuals().table.horizontal(
				rows.map((p) => ({
					profile: p.profile,
					min_version: p.min_version ?? 'N/A',
					in_current_os: p.in_current_os ? 'yes' : 'no',
					fleet: onOff(p.fleet),
					override: p.override == null ? '-' : onOff(p.override),
					effective: onOff(p.effective),
				})),
				[
					'profile',
					'min_version',
					'in_current_os',
					'fleet',
					'override',
					'effective',
				],
			),
		);
	}
}
