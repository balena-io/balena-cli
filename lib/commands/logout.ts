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

import Command from '../command';
import { getBalenaSdk, stripIndent } from '../utils/lazy';

export default class LogoutCmd extends Command {
	public static description = stripIndent`
		Logout from balena.

		Logout from your balena account.
`;
	public static examples = ['$ balena logout'];

	public static usage = 'logout';

	public async run() {
		this.parse<{}, {}>(LogoutCmd);
		await getBalenaSdk().auth.logout();
	}
}
