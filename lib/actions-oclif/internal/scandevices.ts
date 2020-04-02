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

import { stripIndent } from 'common-tags';
import Command from '../../command';

// 'Internal' commands are called during the execution of other commands.
// `scandevices` is called during by `join`,`leave'.
// TODO: These should be refactored to modules/functions, and removed
// 	See previous `internal sudo` refactor:
//    - https://github.com/balena-io/balena-cli/pull/1455/files
//    - https://github.com/balena-io/balena-cli/pull/1455#discussion_r334308357
//    - https://github.com/balena-io/balena-cli/pull/1455#discussion_r334308526

export default class ScandevicesCmd extends Command {
	public static description = stripIndent`
		Scan for local balena-enabled devices and show a picker to choose one.

		Don't use this command directly!
	`;

	public static usage = 'internal scandevices';

	public static root = true;
	public static hidden = true;

	public async run() {
		const { forms } = await import('balena-sync');
		const hostnameOrIp = await forms.selectLocalBalenaOsDevice();
		return console.error(`==> Selected device: ${hostnameOrIp}`);
	}
}
