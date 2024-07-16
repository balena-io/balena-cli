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

import { Flags, Args } from '@oclif/core';
import Command from '../../command.js';
import * as cf from '../../utils/common-flags.js';
import { getBalenaSdk, stripIndent, getCliForm } from '../../utils/lazy.js';
import { ExpectedError } from '../../errors.js';
import type { WhoamiResult } from 'balena-sdk';

interface FlagsDef {
	token: boolean;
	web: boolean;
	credentials: boolean;
	email?: string;
	user?: string;
	password?: string;
	port?: number;
	help: void;
	hideExperimentalWarning: boolean;
}

export default class LoginCmd extends Command {
	public static description = stripIndent`
		Login to balena.

		Login to your balena account.

		This command will prompt you to login using the following login types:

		- Web authorization: open your web browser and prompt to authorize the CLI
		from the dashboard.

		- Credentials: using email/password and 2FA.

		- Token: using a session token or API key from the preferences page.
`;
	public static examples = [
		'$ balena login',
		'$ balena login --web',
		'$ balena login --token "..."',
		'$ balena login --credentials',
		'$ balena login --credentials --email johndoe@gmail.com --password secret',
	];

	public static args = {
		token: Args.string({
			hidden: true,
		}),
	};

	public static usage = 'login';

	public static flags = {
		web: Flags.boolean({
			default: false,
			char: 'w',
			description: 'web-based login',
			exclusive: ['token', 'credentials'],
		}),
		token: Flags.boolean({
			default: false,
			char: 't',
			description: 'session token or API key',
			exclusive: ['web', 'credentials'],
		}),
		credentials: Flags.boolean({
			default: false,
			char: 'c',
			description: 'credential-based login',
			exclusive: ['web', 'token'],
		}),
		email: Flags.string({
			char: 'e',
			description: 'email',
			exclusive: ['user'],
			dependsOn: ['credentials'],
		}),
		// Capitano version of this command had a second alias for email, 'u'.
		// Using an oclif hidden flag to support the same behaviour.
		user: Flags.string({
			char: 'u',
			hidden: true,
			exclusive: ['email'],
			dependsOn: ['credentials'],
		}),
		password: Flags.string({
			char: 'p',
			description: 'password',
			dependsOn: ['credentials'],
		}),
		port: Flags.integer({
			char: 'P',
			description:
				'TCP port number of local HTTP login server (--web auth only)',
			dependsOn: ['web'],
		}),
		hideExperimentalWarning: Flags.boolean({
			char: 'H',
			default: false,
			description: 'Hides warning for experimental features',
		}),
		help: cf.help,
	};

	public static primary = true;

	public async run() {
		const { flags: options, args: params } = await this.parse(LoginCmd);

		const balena = getBalenaSdk();
		const messages = await import('../../utils/messages.js');
		const balenaUrl = await balena.settings.get('balenaUrl');

		// Consolidate user/email options
		if (options.user != null) {
			options.email = options.user;
		}

		console.log(messages.balenaAsciiArt);
		console.log(`\nLogging in to ${balenaUrl}`);
		await this.doLogin(options, balenaUrl, params.token);

		// We can safely assume this won't be undefined as doLogin will throw if this call fails
		// We also don't need to worry too much about the amount of calls to whoami
		// as these are cached by the SDK
		const whoamiResult = (await balena.auth.whoami()) as WhoamiResult;

		if (whoamiResult.actorType !== 'user' && !options.hideExperimentalWarning) {
			console.info(stripIndent`
			----------------------------------------------------------------------------------------
			You are logging in with a ${whoamiResult.actorType} key.
			This is an experimental feature and many features of the CLI might not work as expected.
			We sure hope you know what you are doing.
			----------------------------------------------------------------------------------------
			`);
		}

		console.info(
			`Successfully logged in as: ${this.getLoggedInMessage(whoamiResult)}`,
		);
		console.info(`\

Find out about the available commands by running:

  $ balena help

${messages.reachingOut}`);
	}

	private getLoggedInMessage(whoami: WhoamiResult): string {
		if (whoami.actorType === 'user') {
			return whoami.username;
		}

		const identifier =
			whoami.actorType === 'device' ? whoami.uuid : whoami.slug;
		return `${whoami.actorType} ${identifier}`;
	}

	async doLogin(
		loginOptions: FlagsDef,
		balenaUrl: string = 'balena-cloud.com',
		token?: string,
	): Promise<void> {
		// Token
		if (loginOptions.token) {
			if (!token) {
				token = await getCliForm().ask({
					message: 'Session token or API key from the preferences page',
					name: 'token',
					type: 'input',
				});
			}
			const balena = getBalenaSdk();
			await balena.auth.loginWithToken(token!);
			try {
				if (!(await balena.auth.whoami())) {
					throw new ExpectedError('Token authentication failed');
				}
			} catch (err) {
				if (process.env.DEBUG) {
					console.error(`Get user info failed with: ${err.message}`);
				}
				throw new ExpectedError('Token authentication failed');
			}
			return;
		}
		// Credentials
		else if (loginOptions.credentials) {
			const patterns = await import('../../utils/patterns.js');
			return patterns.authenticate(loginOptions);
		}
		// Web
		else if (loginOptions.web) {
			const auth = await import('../../auth/index.js');
			await auth.login({ port: loginOptions.port });
			return;
		} else {
			const patterns = await import('../../utils/patterns.js');
			// User had not selected login preference, prompt interactively
			const loginType = await patterns.askLoginType();
			if (loginType === 'register') {
				const { default: open } = await import('open');
				const signupUrl = `https://dashboard.${balenaUrl}/signup`;
				await open(signupUrl, { wait: false });
				throw new ExpectedError(`Please sign up at ${signupUrl}`);
			}

			// Set login options flag from askLoginType, and run again
			loginOptions[loginType] = true;
			return this.doLogin(loginOptions);
		}
	}
}
