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

import Command from '../../command.js';
import * as cf from '../../utils/common-flags.js';
import { getBalenaSdk, getVisuals, stripIndent } from '../../utils/lazy.js';

export default class KeysCmd extends Command {
	public static description = stripIndent`
		List the SSH keys in balenaCloud.

		List all SSH keys registered in balenaCloud for the logged in user.
	`;
	public static examples = ['$ balena keys'];

	public static usage = 'keys';

	public static flags = {
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		await this.parse(KeysCmd);

		const keys = await getBalenaSdk().models.key.getAll();

		// Use 'name' instead of 'title' to match dashboard.
		const displayKeys: Array<{ id: number; name: string }> = keys.map((k) => {
			return { id: k.id, name: k.title };
		});

		console.log(getVisuals().table.horizontal(displayKeys, ['id', 'name']));
	}
}
