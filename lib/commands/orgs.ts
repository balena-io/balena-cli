/**
 * @license
 * Copyright 2016-2022 Balena Ltd.
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
import type { DataSetOutputOptions } from '../framework';

import { isV14 } from '../utils/version';

interface FlagsDef extends DataSetOutputOptions {
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
		...(isV14() ? cf.dataSetOutputFlags : {}),
	};

	public static authenticated = true;

	public async run() {
		const { flags: options } = this.parse<FlagsDef, {}>(OrgsCmd);

		const { getOwnOrganizations } = await import('../utils/sdk');

		// Get organizations
		const organizations = await getOwnOrganizations(getBalenaSdk());

		// Display
		if (isV14()) {
			await this.outputData(organizations, ['name', 'handle'], options);
		} else {
			// Old output implementation
			console.log(
				getVisuals().table.horizontal(organizations, ['name', 'handle']),
			);
		}
	}
}
