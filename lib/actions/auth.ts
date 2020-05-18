/*
Copyright 2016-2020 Balena

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { CommandDefinition } from 'capitano';
import { getBalenaSdk, getVisuals } from '../utils/lazy';

export const login: CommandDefinition<
	{},
	{
		token: string | boolean;
		web: boolean;
		credentials: boolean;
		email: string;
		password: string;
	}
> = {
	signature: 'login',
	description: 'login to balena',
	help: `\
Use this command to login to your balena account.

This command will prompt you to login using the following login types:

- Web authorization: open your web browser and prompt you to authorize the CLI
from the dashboard.

- Credentials: using email/password and 2FA.

- Token: using a session token or API key from the preferences page.

Examples:

	$ balena login
	$ balena login --web
	$ balena login --token "..."
	$ balena login --credentials
	$ balena login --credentials --email johndoe@gmail.com --password secret\
`,
	options: [
		{
			signature: 'token',
			description: 'session token or API key',
			parameter: 'token',
			alias: 't',
		},
		{
			signature: 'web',
			description: 'web-based login',
			boolean: true,
			alias: 'w',
		},
		{
			signature: 'credentials',
			description: 'credential-based login',
			boolean: true,
			alias: 'c',
		},
		{
			signature: 'email',
			parameter: 'email',
			description: 'email',
			alias: ['e', 'u'],
		},
		{
			signature: 'password',
			parameter: 'password',
			description: 'password',
			alias: 'p',
		},
	],
	primary: true,
	async action(_params, options) {
		type Options = typeof options;
		const balena = getBalenaSdk();
		const patterns = await import('../utils/patterns');
		const messages = await import('../utils/messages');
		const { exitWithExpectedError } = await import('../errors');

		const doLogin = async (loginOptions: Options): Promise<void> => {
			if (loginOptions.token != null) {
				let token: string;
				if (typeof loginOptions.token === 'string') {
					token = loginOptions.token;
				} else {
					const form = await import('resin-cli-form');
					token = await form.ask({
						message: 'Session token or API key from the preferences page',
						name: 'token',
						type: 'input',
					});
				}
				await balena.auth.loginWithToken(token);
				if (!(await balena.auth.whoami())) {
					exitWithExpectedError('Token authentication failed');
				}
				return;
			} else if (loginOptions.credentials) {
				return patterns.authenticate(loginOptions);
			} else if (loginOptions.web) {
				const auth = await import('../auth');
				await auth.login();
				return;
			}

			const loginType = await patterns.askLoginType();
			if (loginType === 'register') {
				const signupUrl = 'https://dashboard.balena-cloud.com/signup';
				const open = await import('open');
				open(signupUrl, { wait: false });
				return exitWithExpectedError(`Please sign up at ${signupUrl}`);
			}

			loginOptions[loginType] = true;
			return doLogin(loginOptions);
		};

		const balenaUrl = await balena.settings.get('balenaUrl');

		console.log(messages.balenaAsciiArt);
		console.log(`\nLogging in to ${balenaUrl}`);
		await doLogin(options);
		const username = await balena.auth.whoami();

		console.info(`Successfully logged in as: ${username}`);
		console.info(`\

Find out about the available commands by running:

  $ balena help

${messages.reachingOut}`);

		if (options.web) {
			const { shutdownServer } = await import('../auth');
			shutdownServer();
		}
	},
};

export const logout: CommandDefinition = {
	signature: 'logout',
	description: 'logout from balena',
	help: `\
Use this command to logout from your balena account.

Examples:

	$ balena logout\
`,
	async action(_params) {
		await getBalenaSdk().auth.logout();
	},
};

export const whoami: CommandDefinition = {
	signature: 'whoami',
	description: 'get current username and email address',
	help: `\
Use this command to find out the current logged in username and email address.

Examples:

	$ balena whoami\
`,
	permission: 'user',
	async action() {
		const balena = getBalenaSdk();

		const [username, email, url] = await Promise.all([
			balena.auth.whoami(),
			balena.auth.getEmail(),
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
	},
};
