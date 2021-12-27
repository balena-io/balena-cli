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

export default class KeysCmd extends Command {
	public static description = stripIndent`
		List the SSH keys in balenaCloud.

		List all SSH keys registered in balenaCloud for the logged in user.
	`;
	public static examples = ['$ balena keys'];

	public static usage = 'keys';

	public static flags: flags.Input<FlagsDef> = {
		...(isV14() ? cf.dataSetOutputFlags : {}),
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { flags: options } = this.parse<FlagsDef, {}>(KeysCmd);

		const keys = await getBalenaSdk().models.key.getAll();

		// Use 'name' instead of 'title' to match dashboard.
		const displayKeys: Array<{ id: number; name: string }> = keys.map((k) => {
			return { id: k.id, name: k.title };
		});

		// Display
		if (isV14()) {
			await this.outputData(displayKeys, ['id', 'name'], options);
		} else {
			// Old output implementation
			console.log(getVisuals().table.horizontal(displayKeys, ['id', 'name']));
		}
	}
}
