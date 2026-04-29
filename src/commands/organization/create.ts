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

import { Args, Command } from '@oclif/core';
import { getBalenaSdk, getVisuals, stripIndent } from '../../utils/lazy';

export default class OrganizationCreateCmd extends Command {
	public static description = stripIndent`
		Create an organization.

		Create a new organization.
`;

	public static examples = ['$ balena organization create MyOrg'];

	public static args = {
		orgName: Args.string({
			description: 'the name to use for the new organization',
			required: true,
		}),
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = await this.parse(OrganizationCreateCmd);

		const balena = getBalenaSdk();
		const org = await balena.models.organization.create({
			name: params.orgName,
		});

		console.log(
			getVisuals().table.vertical(org, ['id', 'name', 'handle', 'created_at']),
		);
	}
}
