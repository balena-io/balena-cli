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

import { Flags, Command } from '@oclif/core';
import * as cf from '../../utils/common-flags';
import { getBalenaSdk, getVisuals, stripIndent } from '../../utils/lazy';

export default class APIKeyListCmd extends Command {
	public static aliases = ['api-keys'];
	public static deprecateAliases = true;

	public static description = stripIndent`
		Print a list of balenaCloud API keys.

		Print a list of balenaCloud API keys.

		Print a list of balenaCloud API keys for the current user or for a specific fleet with the \`--fleet\` option.
`;
	public static examples = ['$ balena api-key list'];

	public static flags = {
		user: Flags.boolean({
			char: 'u',
			description: 'show API keys for your user',
		}),
		fleet: cf.fleet,
	};

	public static authenticated = true;

	public async run() {
		const { flags: options } = await this.parse(APIKeyListCmd);

		const { getApplication } = await import('../../utils/sdk');
		const actorId = options.fleet
			? (
					await getApplication(getBalenaSdk(), options.fleet, {
						$select: 'actor',
					})
				).actor.__id
			: await getBalenaSdk().auth.getActorId();
		const keys = await getBalenaSdk().pine.get({
			resource: 'api_key',
			options: {
				$select: ['id', 'created_at', 'name', 'description', 'expiry_date'],
				$filter: {
					is_of__actor: actorId,
					...(options.user
						? {
								name: {
									$ne: null,
								},
							}
						: {}),
				},
				$orderby: 'name asc',
			},
		});
		const fields = ['id', 'name', 'created_at', 'description', 'expiry_date'];
		const _ = await import('lodash');
		console.log(
			getVisuals().table.horizontal(
				keys.map((key) => _.mapValues(key, (val) => val ?? 'N/a')),
				fields,
			),
		);
	}
}
