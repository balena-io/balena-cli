/*
Copyright 2016-2017 Resin.io

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

export const login: CommandDefinition<
	{},
	{
		web: boolean;
		credentials: boolean;
		token?: string;
		email?: string;
		password?: string;
	}
> = {
	signature: 'login',
	description: 'login to resin.io',
	help: `\
Use this command to login to your resin.io account.

This command will prompt you to login using the following login types:

- Web authorization: open your web browser and prompt you to authorize the CLI
from the dashboard.

- Credentials: using email/password and 2FA.

- Token: using the authentication token from the preferences page.

Examples:

	$ resin login
	$ resin login --web
	$ resin login --token "..."
	$ resin login --credentials
	$ resin login --credentials --email johndoe@gmail.com --password secret\
`,
	options: [
		{
			signature: 'token',
			description: 'auth token',
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
	async action(_params, options, done) {
		const _ = await import('lodash');
		const Bluebird = await import('bluebird');
		const { resin } = await import('../sdk');
		const auth = await import('../auth');
		const form = await import('resin-cli-form');
		const patterns = await import('../utils/patterns');
		const messages = await import('../utils/messages');

		const resinUrl = await resin.settings.get('resinUrl');

		console.log(messages.resinAsciiArt);
		console.log(`\nLogging in to ${resinUrl}`);

		if (!options.token && !options.credentials && !options.web) {
			let loginType = await patterns.askLoginType();

			if (loginType === 'register') {
				const capitano = await import('capitano');
				const capitanoRunAsync = Bluebird.promisify(capitano.run);
				return capitanoRunAsync('signup');
			}

			options[loginType] = true;
		}

		if (options.token) {
			const token = _.isString(options.token)
				? options.token
				: await form.ask({
						message: 'Token (from the preferences page)',
						name: 'token',
						type: 'input',
					});
			await resin.auth.loginWithToken(token);
		} else if (options.credentials) {
			await patterns.authenticate(options);
		} else if (options.web) {
			console.info('Connecting to the web dashboard');
			await auth.login();
		}

		const username = await resin.auth.whoami();

		console.info(`Successfully logged in as: ${username}`);

		console.info(`\

Find out about the available commands by running:

  $ resin help

${messages.reachingOut}\
`);
		done();
	},
};

export const logout: CommandDefinition = {
	signature: 'logout',
	description: 'logout from resin.io',
	help: `\
Use this command to logout from your resin.io account.o

Examples:

	$ resin logout\
`,
	async action(_params, _options, done) {
		const { resin } = await import('../sdk');
		return resin.auth.logout().nodeify(done);
	},
};

export const signup: CommandDefinition = {
	signature: 'signup',
	description: 'signup to resin.io',
	help: `\
Use this command to signup for a resin.io account.

If signup is successful, you'll be logged in to your new user automatically.

Examples:

	$ resin signup
	Email: johndoe@acme.com
	Password: ***********

	$ resin whoami
	johndoe\
`,
	async action(_params, _options, done) {
		const { resin } = await import('../sdk');
		const form = await import('resin-cli-form');
		const validation = await import('../utils/validation');

		const resinUrl = await resin.settings.get('resinUrl');

		console.log(`\nRegistering to ${resinUrl}`);

		const credentials: { email: string; password: string } = await form.run([
			{
				message: 'Email:',
				name: 'email',
				type: 'input',
				validate: validation.validateEmail,
			},
			{
				message: 'Password:',
				name: 'password',
				type: 'password',
				validate: validation.validatePassword,
			},
		]);

		const token = await resin.auth.register(credentials);
		await resin.auth.loginWithToken(token);
		done();
	},
};

export const whoami: CommandDefinition = {
	signature: 'whoami',
	description: 'get current username and email address',
	help: `\
Use this command to find out the current logged in username and email address.

Examples:

	$ resin whoami\
`,
	permission: 'user',
	async action(_params, _options, done) {
		const Bluebird = await import('bluebird');
		const { resin } = await import('../sdk');
		const visuals = await import('resin-cli-visuals');

		const results = await Bluebird.props({
			username: resin.auth.whoami(),
			email: resin.auth.getEmail(),
			url: resin.settings.get('resinUrl'),
		});

		console.log(
			visuals.table.vertical(results, [
				'$account information$',
				'username',
				'email',
				'url',
			]),
		);

		done();
	},
};
