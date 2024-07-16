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
import { getBalenaSdk, getVisuals, stripIndent } from '../../utils/lazy.js';

export default class WhoamiCmd extends Command {
	public static description = stripIndent`
		Display account information for current user.

		Get the username and email address of the currently logged in user.
	`;

	public static examples = ['$ balena whoami'];

	public static usage = 'whoami';

	public static authenticated = true;

	public async run() {
		await this.parse(WhoamiCmd);

		const balena = getBalenaSdk();

		const [whoamiResult, url] = await Promise.all([
			balena.auth.whoami(),
			balena.settings.get('balenaUrl'),
		]);

		if (whoamiResult?.actorType === 'user') {
			const { username, email } = whoamiResult;
			console.log(
				getVisuals().table.vertical({ username, email, url }, [
					'$account information$',
					'username',
					'email',
					'url',
				]),
			);
		} else if (whoamiResult?.actorType === 'device') {
			console.log(
				getVisuals().table.vertical({ device: whoamiResult.uuid, url }, [
					'$account information$',
					'device',
					'url',
				]),
			);
		} else if (whoamiResult?.actorType === 'application') {
			console.log(
				getVisuals().table.vertical({ application: whoamiResult.slug, url }, [
					'$account information$',
					'application',
					'url',
				]),
			);
		}
	}
}
