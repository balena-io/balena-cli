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

import { Command } from '@oclif/core';
import { getBalenaSdk, getVisuals, stripIndent } from '../../../utils/lazy';
import { commitOrIdArg } from '../../release';

export default class ReleaseProfileListCmd extends Command {
	public static enableJsonFlag = true;
	public static description = stripIndent`
		List the profiles of a release.

		List the profiles provided by a release, along with the services whose
		images are tagged with each of them.
	`;

	public static examples = [
		'$ balena release profile list 1234567',
		'$ balena release profile list a777f7345fe3d655c1c981aa642e5555 --json',
	];

	public static args = {
		commitOrId: commitOrIdArg({
			description: 'the commit or ID of the release',
			required: true,
		}),
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(
			ReleaseProfileListCmd,
		);

		const { getProfileModels } = await import('../../../utils/profiles');

		const { release } = getProfileModels(getBalenaSdk());
		const imageProfiles = await release.profile.getAllByRelease(
			params.commitOrId,
			{
				$select: 'profile_name',
				$expand: {
					release_image: {
						$select: 'image',
						$expand: {
							image: {
								$select: 'is_a_build_of__service',
								$expand: {
									is_a_build_of__service: { $select: 'service_name' },
								},
							},
						},
					},
				},
			},
		);

		const servicesByProfile = new Map<string, Set<string>>();
		for (const { profile_name, release_image } of imageProfiles) {
			const services = servicesByProfile.get(profile_name) ?? new Set();
			const serviceName =
				release_image[0]?.image[0]?.is_a_build_of__service[0]?.service_name;
			if (serviceName != null) {
				services.add(serviceName);
			}
			servicesByProfile.set(profile_name, services);
		}
		const profiles = [...servicesByProfile]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([profile, services]) => ({
				profile,
				services: [...services].sort(),
			}));

		if (options.json) {
			return JSON.stringify(profiles, null, 4);
		}
		if (profiles.length === 0) {
			console.log('No profiles found for this release');
			return;
		}
		console.log(
			getVisuals().table.horizontal(
				profiles.map((p) => ({ ...p, services: p.services.join(', ') })),
				['profile', 'services'],
			),
		);
	}
}
