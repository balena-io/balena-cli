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
import { stripIndent } from 'common-tags';
import Command from '../../command';
import { ExpectedError } from '../../errors';
import * as cf from '../../utils/common-flags';
import { getBalenaSdk } from '../../utils/lazy';

interface FlagsDef {
	help: void;
}

interface ArgsDef {
	name: string;
	path: string;
}

export default class KeyAddCmd extends Command {
	public static description = stripIndent`
		Add an SSH key to balenaCloud.

		Register an SSH in balenaCloud for the logged in user.

		If \`path\` is omitted, the command will attempt
		to read the SSH key from stdin.
	`;

	public static examples = [
		'$ balena key add Main ~/.ssh/id_rsa.pub',
		'$ cat ~/.ssh/id_rsa.pub | balena key add Main',
	];

	public static args = [
		{
			name: 'name',
			description: 'the SSH key name',
			required: true,
		},
		{
			name: `path`,
			description: `the path to the public key file`,
		},
	];

	public static usage = 'key add <name> [path]';

	public static flags: flags.Input<FlagsDef> = {
		help: cf.help,
	};

	public static authenticated = true;

	public static readStdin = true;

	public async run() {
		const { args: params } = this.parse<FlagsDef, ArgsDef>(KeyAddCmd);

		let key: string;
		if (params.path != null) {
			const { promisify } = await import('util');
			const readFileAsync = promisify((await import('fs')).readFile);
			key = await readFileAsync(params.path, 'utf8');
		} else if (this.stdin.length > 0) {
			key = this.stdin;
		} else {
			throw new ExpectedError('No public key file or path provided.');
		}

		await getBalenaSdk().models.key.create(params.name, key);
	}
}
