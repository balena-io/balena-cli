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
import { lowercaseIfSlug } from '../../../utils/normalization';
import { getBalenaSdk, stripIndent } from '../../../utils/lazy';
import { applicationIdInfo } from '../../../utils/messages';

export default class FleetProfileDeactivateCmd extends Command {
	public static description = stripIndent`
		Deactivate OS profiles for a fleet.

		Deactivate one or more OS profiles (by name), as provided by an OS (host)
		application, for the devices of a fleet operated by that OS application.
		Profiles that are already inactive are left untouched. Devices with a
		profile override (see \`device profile\`) are not affected. Note that
		devices may reboot to apply profile changes.

		The OS application can be omitted for fleets whose devices are all operated
		by the same OS application, and must be specified otherwise.

		Available profiles, and the OS applications providing them, can be listed
		with the \`fleet profile list\` command.

		${applicationIdInfo.split('\n').join('\n\t\t')}
	`;

	public static examples = [
		'$ balena fleet profile deactivate myorg/myfleet profilename',
		'$ balena fleet profile deactivate myorg/myfleet balena_os/raspberrypi5 profilename',
		'$ balena fleet profile deactivate myorg/myfleet balena_os/raspberrypi5 profilename1,profilename2',
	];

	public static args = {
		fleet: ca.fleetOrIdRequired,
		// Optional in between required args, so both are declared optional and
		// a single one of them (see run()) is the profile names
		hostApp: Args.string({
			description:
				'OS (host) application slug, eg balena_os/raspberrypi5, optional for fleets whose devices are all operated by the same OS application',
			parse: lowercaseIfSlug,
		}),
		profiles: Args.string({
			description: 'comma-separated list (no blank spaces) of profile names',
		}),
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = await this.parse(FleetProfileDeactivateCmd);
		// `<fleet> <profiles>` or `<fleet> <hostApp> <profiles>`
		const [hostApp, profiles] =
			params.profiles == null
				? [undefined, params.hostApp]
				: [params.hostApp, params.profiles];
		const names = await ca.parseProfileNames(profiles ?? '');

		const balena = getBalenaSdk();
		const { getApplication } = await import('../../../utils/sdk');
		const { getProfileModels } = await import('../../../utils/profiles');
		const { runConcurrently } = await import('../../../utils/helpers');

		const fleet = await getApplication(balena, params.fleet, {
			$select: ['id', 'slug'],
		});
		const { application } = getProfileModels(balena);
		await runConcurrently(
			names.map((name) => ({
				context: `profile: ${name}`,
				run: async () => {
					await application.profile.deactivate(fleet.id, name, hostApp);
					return `Profile '${name}' deactivated for fleet ${fleet.slug}`;
				},
			})),
		);
	}
}
