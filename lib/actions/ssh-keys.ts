/*
Copyright 2019 Balena Ltd.

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
import { stripIndent } from 'common-tags';

export const sshKeys: CommandDefinition<
	{
		file?: string;
		title?: string;
	},
	{
		'list-fingerprints'?: boolean;
		'list-keys'?: boolean;
		'delete-key'?: number;
		'delete-all-keys'?: boolean;
		'add-all-keys'?: boolean;
	}
> = {
	signature: 'ssh-keys [file] [title]',
	primary: true,
	description: 'Manage ssh keys',
	help: stripIndent`
		This command exposes an interface similar to \`ssh-add\` and can be used to manage your authorized keys.

		Examples:

			$ balena ssh-keys <file> [title]
			$ balena ssh-keys -L
			$ balena ssh-keys -d <key-id>
			$ balena ssh-keys -D
			$ balena ssh-keys -A
	`,
	options: [
		{
			signature: 'list-keys',
			alias: 'L',
			description: 'List public key parameters of all identities.',
			boolean: true,
		},
		{
			signature: 'delete-key',
			alias: 'd',
			description: 'Delete identity.',
			parameter: 'key-id',
		},
		{
			signature: 'delete-all-keys',
			alias: 'D',
			description: 'Delete all identities.',
			boolean: true,
		},
		{
			signature: 'add-all-keys',
			alias: 'A',
			description: 'Add all identities stored at ~/.ssh/id_{ed25519,{r,d}sa}',
			boolean: true,
		},
	],
	async action(params, options, done) {
		const fs = await import('fs');
		const balena = (await import('balena-sdk')).fromSharedOptions();
		const visuals = await import('resin-cli-visuals');

		const { confirm } = await import('../utils/patterns');

		const resource = 'user__has__public_key';

		const formatKeys = (data: any) =>
			visuals.table.horizontal(data, ['id', 'title', 'public_key']);
		const addSshKey = async (title: string, publicKey: Buffer) => {
			return balena.auth.getUserId().then(user =>
				balena.pine
					.post({
						resource,
						body: {
							created_at: new Date(),
							user,
							title,
							public_key: publicKey.toString().trim(),
						},
					})
					.then(formatKeys)
					.tap(console.log),
			);
		};

		if (params.file != null) {
			return addSshKey(
				params.title != null ? params.title : params.file,
				fs.readFileSync(params.file),
			);
		} else if (options['list-keys']) {
			return balena.pine
				.get({ resource })
				.then(formatKeys)
				.tap(console.log)
				.then(done);
		} else if (options['delete-key'] != null) {
			return balena.pine
				.delete({ resource, id: options['delete-key'] })
				.tap(console.log)
				.then(done);
		} else if (options['delete-all-keys']) {
			return confirm(false, 'Delete ALL ssh keys?').tap(() =>
				balena.pine
					.delete({ resource })
					.tap(console.log)
					.then(done),
			);
		} else if (options['add-all-keys']) {
			const { HOME, HOST } = process.env;
			return Promise.all(
				['id_ed25519', 'id_rsa', 'id_dsa'].map(fn => {
					const path = `${HOME}/.ssh/${fn}.pub`;
					if (fs.existsSync(path)) {
						addSshKey(
							HOST != null ? `${fn}@${HOST}` : fn,
							fs.readFileSync(path),
						);
					}
				}),
			).then(done);
		}

		done();
	},
};
