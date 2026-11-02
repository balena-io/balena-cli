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

export default class AppProfileListCmd extends Command {
	public static enableJsonFlag = true;
	public static description = stripIndent`
		List the profiles provided by an OS application.

		List the profiles provided by the releases of an OS (host) application,
		eg \`balena_os/raspberrypi5\`, along with the earliest successful release
		version that provides each of them.
	`;

	public static examples = [
		'$ balena app profile list balena_os/raspberrypi5',
		'$ balena app profile list balena_os/raspberrypi5 --json',
	];

	public static args = {
		slugOrId: Args.string({
			description: 'app slug or numeric ID',
			required: true,
		}),
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } =
			await this.parse(AppProfileListCmd);

		const { getProfileModels } = await import('../../../utils/profiles');

		const { application } = getProfileModels(getBalenaSdk());
		const slugOrId = /^\d+$/.test(params.slugOrId)
			? Number(params.slugOrId)
			: params.slugOrId.toLowerCase();
		const profiles = (
			await application.profile.getCatalog(slugOrId, {
				$select: ['catalogs__profile_name', 'description'],
				$expand: { available_since__release: { $select: 'raw_version' } },
				$orderby: { catalogs__profile_name: 'asc' },
			})
		).map((entry) => ({
			profile: entry.catalogs__profile_name,
			description: entry.description,
			min_version: entry.available_since__release[0]?.raw_version ?? null,
		}));

		if (options.json) {
			return JSON.stringify(profiles, null, 4);
		}
		if (profiles.length === 0) {
			console.log(`No profiles available for ${params.slugOrId}`);
			return;
		}
		console.log(
			getVisuals().table.horizontal(
				profiles.map((p) => ({
					...p,
					min_version: p.min_version ?? 'N/A',
					description: p.description ?? '',
				})),
				['profile', 'min_version', 'description'],
			),
		);
	}
}
