/*
Copyright 2016-2017 Balena

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { CommandDefinition } from 'capitano';
import { getBalenaSdk, getVisuals } from '../utils/lazy';
import * as commandOptions from './command-options';

export const list: CommandDefinition = {
	signature: 'keys',
	description: 'list all ssh keys',
	help: `\
Use this command to list all your SSH keys.

Examples:

	$ balena keys\
`,
	permission: 'user',
	async action() {
		const keys = await getBalenaSdk().models.key.getAll();

		console.log(getVisuals().table.horizontal(keys, ['id', 'title']));
	},
};

export const info: CommandDefinition<{ id: string }> = {
	signature: 'key <id>',
	description: 'list a single ssh key',
	help: `\
Use this command to show information about a single SSH key.

Examples:

	$ balena key 17\
`,
	permission: 'user',
	async action(params) {
		const key = await getBalenaSdk().models.key.get(parseInt(params.id, 10));

		console.log(getVisuals().table.vertical(key, ['id', 'title']));

		// Since the public key string is long, it might
		// wrap to lines below, causing the table layout to break.
		// See https://github.com/balena-io/balena-cli/issues/151
		console.log('\n' + key.public_key);
	},
};

export const remove: CommandDefinition<
	{ id: string },
	commandOptions.YesOption
> = {
	signature: 'key rm <id>',
	description: 'remove a ssh key',
	help: `\
Use this command to remove a SSH key from balena.

Notice this command asks for confirmation interactively.
You can avoid this by passing the \`--yes\` boolean option.

Examples:

	$ balena key rm 17
	$ balena key rm 17 --yes\
`,
	options: [commandOptions.yes],
	permission: 'user',
	async action(params, options) {
		const patterns = await import('../utils/patterns');

		await patterns.confirm(
			options.yes ?? false,
			'Are you sure you want to delete the key?',
		);

		await getBalenaSdk().models.key.remove(parseInt(params.id, 10));
	},
};

export const add: CommandDefinition<{ name: string; path: string }> = {
	signature: 'key add <name> [path]',
	description: 'add a SSH key to balena',
	help: `\
Use this command to associate a new SSH key with your account.

If \`path\` is omitted, the command will attempt
to read the SSH key from stdin.

Examples:

	$ balena key add Main ~/.ssh/id_rsa.pub
	$ cat ~/.ssh/id_rsa.pub | balena key add Main\
`,
	permission: 'user',
	async action(params) {
		let key: string;
		if (params.path != null) {
			const { promisify } = await import('util');
			const readFileAsync = promisify((await import('fs')).readFile);
			key = await readFileAsync(params.path, 'utf8');
		} else {
			const getStdin = await import('get-stdin');
			key = await getStdin();
		}

		await getBalenaSdk().models.key.create(params.name, key);
	},
};
