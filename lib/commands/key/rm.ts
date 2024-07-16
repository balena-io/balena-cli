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
import * as cf from '../../utils/common-flags.js';
import { getBalenaSdk, stripIndent } from '../../utils/lazy.js';
import { parseAsInteger } from '../../utils/validation.js';

export default class KeyRmCmd extends Command {
	public static description = stripIndent`
		Remove an SSH key from balenaCloud.

		Remove a single SSH key registered in balenaCloud for the logged in user.

		The --yes option may be used to avoid interactive confirmation.
	`;

	public static examples = ['$ balena key rm 17', '$ balena key rm 17 --yes'];

	public static args = {
		id: Args.integer({
			description: 'balenaCloud ID for the SSH key',
			parse: async (x) => parseAsInteger(x, 'id'),
			required: true,
		}),
	};

	public static usage = 'key rm <id>';

	public static flags = {
		yes: cf.yes,
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(KeyRmCmd);

		const patterns = await import('../../utils/patterns.js');

		await patterns.confirm(
			options.yes ?? false,
			`Are you sure you want to delete key ${params.id}?`,
		);

		await getBalenaSdk().models.key.remove(params.id);
	}
}
