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
import { getBalenaSdk, stripIndent } from '../../utils/lazy.js';

export default class SettingsCmd extends Command {
	public static description = stripIndent`
		Print current settings.

		Use this command to display the current balena CLI settings.
`;
	public static examples = ['$ balena settings'];

	public static usage = 'settings';

	public static flags = {
		help: cf.help,
	};

	public async run() {
		await this.parse(SettingsCmd);

		const settings = await getBalenaSdk().settings.getAll();

		const prettyjson = await import('prettyjson');
		console.log(prettyjson.render(settings));
	}
}
