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

import { Command } from '@oclif/core';
import { getBalenaSdk, getVisuals, stripIndent } from '../../utils/lazy';

export default class OrganizationListCmd extends Command {
	public static aliases = ['orgs'];
	public static deprecateAliases = true;

	public static description = stripIndent`
		List all organizations.

		list all the organizations that you are a member of.
`;
	public static examples = ['$ balena organization list'];

	public static authenticated = true;

	public async run() {
		await this.parse(OrganizationListCmd);

		const { getOwnOrganizations } = await import('../../utils/sdk');

		// Get organizations
		const organizations = await getOwnOrganizations(getBalenaSdk(), {
			$select: ['name', 'handle'],
		});

		// Display
		console.log(
			getVisuals().table.horizontal(organizations, ['name', 'handle']),
		);
	}
}
