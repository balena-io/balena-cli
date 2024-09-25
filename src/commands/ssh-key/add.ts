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
import { ExpectedError } from '../../errors';
import * as cf from '../../utils/common-flags';
import { getBalenaSdk, stripIndent } from '../../utils/lazy';

export default class KeyAddCmd extends Command {
	public static description = stripIndent`
		Add an SSH key to balenaCloud.

		Add an SSH key to the balenaCloud account of the logged in user.

		If \`path\` is omitted, the command will attempt to read the SSH key from stdin.

		About SSH keys
		An "SSH key" actually consists of a public/private key pair. A typical name
		for the private key file is "id_rsa", and a typical name for the public key
		file is "id_rsa.pub". Both key files are saved to your computer (with the
		private key optionally protected by a password), but only the public key is
		saved to your balena account.  This means that if you change computers or
		otherwise lose the private key, you cannot recover the private key through
		your balena account. You can however add new keys, and delete the old ones.

		To generate a new SSH key pair, a nice guide can be found in GitHub's docs:
		https://help.github.com/en/articles/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent
		Skip the step about adding the key to a GitHub account, and instead add it to
		your balena account.
	`;

	public static examples = [
		'$ balena key add Main ~/.ssh/id_rsa.pub',
		'$ cat ~/.ssh/id_rsa.pub | balena key add Main',
		'# Windows 10 (cmd.exe prompt) example',
		'$ balena key add Main %userprofile%.sshid_rsa.pub',
	];

	public static args = {
		name: Args.string({
			description: 'the SSH key name',
			required: true,
		}),
		path: Args.string({
			description: `the path to the public key file`,
		}),
	};

	public static flags = {
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = await this.parse(KeyAddCmd);

		let key: string;
		if (params.path != null) {
			const { readFile } = (await import('fs')).promises;
			key = await readFile(params.path, 'utf8');
		} else {
			throw new ExpectedError('No public key file or path provided.');
		}

		await getBalenaSdk().models.key.create(params.name, key);
	}
}
