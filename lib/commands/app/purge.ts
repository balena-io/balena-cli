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
import { getBalenaSdk, stripIndent } from '../../utils/lazy';
import { tryAsInteger } from '../../utils/validation';

interface FlagsDef {
	help: void;
}

interface ArgsDef {
	name: string;
}

export default class AppRestartCmd extends Command {
	public static description = stripIndent`
		Purge data from an application.

		Purge data from all devices belonging to an application.
		This will clear the application's /data directory.
`;
	public static examples = ['$ balena app purge MyApp'];

	public static args = [
		{
			name: 'name',
			description: 'application name or numeric ID',
			required: true,
		},
	];

	public static usage = 'app purge <name>';

	public static flags: flags.Input<FlagsDef> = {
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = this.parse<FlagsDef, ArgsDef>(AppRestartCmd);

		const balena = getBalenaSdk();

		// balena.models.application.purge only accepts a numeric id
		// so we must first fetch the app to get it's id, if we have been given a name
		let nameOrId = tryAsInteger(params.name);

		if (typeof nameOrId === 'string') {
			const app = await balena.models.application.get(nameOrId);
			nameOrId = app.id;
		}

		try {
			await balena.models.application.purge(nameOrId);
		} catch (e) {
			if (e.message.toLowerCase().includes('no online device(s) found')) {
				// application.purge throws an error if no devices are online
				// ignore in this case.
			} else {
				throw e;
			}
		}
	}
}
