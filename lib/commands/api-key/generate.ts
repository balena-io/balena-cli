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

import { Args } from '@oclif/core';
import Command from '../../command.js';
import { ExpectedError } from '../../errors.js';
import * as cf from '../../utils/common-flags.js';
import { getBalenaSdk, stripIndent } from '../../utils/lazy.js';

export default class GenerateCmd extends Command {
	public static description = stripIndent`
		Generate a new balenaCloud API key.

		Generate a new balenaCloud API key for the current user, with the given
		name. The key will be logged to the console.

		This key can be used to log into the CLI using 'balena login --token <key>',
		or to authenticate requests to the API with an 'Authorization: Bearer <key>' header.
`;
	public static examples = ['$ balena api-key generate "Jenkins Key"'];

	public static args = {
		name: Args.string({
			description: 'the API key name',
			required: true,
		}),
	};

	public static usage = 'api-key generate <name>';

	public static flags = {
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = await this.parse(GenerateCmd);

		let key;
		try {
			key = await getBalenaSdk().models.apiKey.create(params.name);
		} catch (e) {
			if (e.name === 'BalenaNotLoggedIn') {
				throw new ExpectedError(stripIndent`
					This command cannot be run when logged in with an API key.
					Please login again with 'balena login' and select an alternative method.
				`);
			} else {
				throw e;
			}
		}

		console.log(stripIndent`
			Registered api key '${params.name}':

			${key}

			This key will not be shown again, so please save it now.
		`);
	}
}
