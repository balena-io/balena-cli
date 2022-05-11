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
import Command from '../../command';
import * as cf from '../../utils/common-flags';
import { getBalenaSdk, getVisuals, stripIndent } from '../../utils/lazy';
import { parseAsInteger } from '../../utils/validation';

type IArg<T> = import('@oclif/parser').args.IArg<T>;

interface FlagsDef {
	help: void;
}

interface ArgsDef {
	id: number;
}

export default class KeyCmd extends Command {
	public static description = stripIndent`
		Display an SSH key.

		Display a single SSH key registered in balenaCloud for the logged in user.
	`;

	public static examples = ['$ balena key 17'];

	public static args: Array<IArg<any>> = [
		{
			name: 'id',
			description: 'balenaCloud ID for the SSH key',
			parse: (x) => parseAsInteger(x, 'id'),
			required: true,
		},
	];

	public static usage = 'key <id>';

	public static flags: flags.Input<FlagsDef> = {
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = this.parse<{}, ArgsDef>(KeyCmd);

		const key = await getBalenaSdk().models.key.get(params.id);

		// Use 'name' instead of 'title' to match dashboard.
		const displayKey = {
			id: key.id,
			name: key.title,
		};

		console.log(getVisuals().table.vertical(displayKey, ['id', 'name']));

		// Since the public key string is long, it might
		// wrap to lines below, causing the table layout to break.
		// See https://github.com/balena-io/balena-cli/issues/151
		console.log('\n' + key.public_key);
	}
}
