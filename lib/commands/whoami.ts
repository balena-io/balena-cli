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
import { getBalenaSdk, getVisuals, stripIndent } from '../utils/lazy';

export default class WhoamiCmd extends Command {
	public static description = stripIndent`
		Display account information for current user.

		Get the username and email address of the currently logged in user.
	`;

	public static examples = ['$ balena whoami'];

	public static usage = 'whoami';

	public static authenticated = true;

	public async run() {
		this.parse<{}, {}>(WhoamiCmd);

		const balena = getBalenaSdk();

		const [{ username, email }, url] = await Promise.all([
			balena.auth.getUserInfo(),
			balena.settings.get('balenaUrl'),
		]);

		console.log(
			getVisuals().table.vertical({ username, email, url }, [
				'$account information$',
				'username',
				'email',
				'url',
			]),
		);
	}
}
