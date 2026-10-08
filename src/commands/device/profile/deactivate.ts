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
import * as ca from '../../../utils/common-args';
import { getBalenaSdk, stripIndent } from '../../../utils/lazy';

export default class DeviceProfileDeactivateCmd extends Command {
	public static description = stripIndent`
		Deactivate OS profiles on devices.

		Force one or more OS profiles off for one or more devices, regardless of the
		fleet setting, by creating or updating a device profile override. Devices
		where the profile is already overridden to inactive are left untouched.
		Use \`device profile remove-override\` to revert to the fleet setting.
		Note that devices may reboot to apply profile changes.

		Available profiles can be listed with the \`device profile list\` command.
	`;

	public static examples = [
		'$ balena device profile deactivate 7cf02a6 profilename',
		'$ balena device profile deactivate 7cf02a6,dc39e52 profilename1,profilename2',
	];

	public static args = {
		uuid: Args.string({
			description: 'comma-separated list (no blank spaces) of device UUIDs',
			required: true,
		}),
		profiles: ca.profileNamesRequired,
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = await this.parse(DeviceProfileDeactivateCmd);

		const { getProfileModels } = await import('../../../utils/profiles');
		const { runConcurrently } = await import('../../../utils/helpers');
		const { resolveDeviceUuidParam } = await import('../../../utils/sdk');

		const { device } = getProfileModels(getBalenaSdk());
		const uuids = [...new Set(params.uuid.split(',').filter((s) => s !== ''))];
		await runConcurrently(
			uuids.flatMap((uuid) => {
				// Resolved once per device, shared by the tasks of all its profiles
				const fullUuid = resolveDeviceUuidParam(uuid);
				return params.profiles.map((name) => ({
					context: `uuid: ${uuid}, profile: ${name}`,
					run: async () => {
						const deviceUuid = await fullUuid;
						await device.profile.deactivate(deviceUuid, name);
						return `Profile '${name}' deactivated on device ${deviceUuid}`;
					},
				}));
			}),
		);
	}
}
