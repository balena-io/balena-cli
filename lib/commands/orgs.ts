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

import { flags } from '@oclif/command';
import Command from '../command';
import * as cf from '../utils/common-flags';
import { getBalenaSdk, getVisuals, stripIndent } from '../utils/lazy';

interface FlagsDef {
	help: void;
}

export default class OrgsCmd extends Command {
	public static description = stripIndent`
		List all organizations.

		list all the organizations that you are a member of.
`;
	public static examples = ['$ balena orgs'];

	public static usage = 'orgs';

	public static flags: flags.Input<FlagsDef> = {
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		this.parse<FlagsDef, {}>(OrgsCmd);

		const { getOwnOrganizations } = await import('../utils/sdk');

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
