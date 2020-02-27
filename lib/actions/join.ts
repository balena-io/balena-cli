/*
Copyright 2016-2017 Balena

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
import * as Bluebird from 'bluebird';
import { CommandDefinition } from 'capitano';
import { stripIndent } from 'common-tags';
import { getBalenaSdk } from '../utils/lazy';

interface Args {
	deviceIp?: string;
}

interface Options {
	application?: string;
}

export const join: CommandDefinition<Args, Options> = {
	signature: 'join [deviceIp]',
	description:
		'Promote a local device running balenaOS to join an application on a balena server',
	help: stripIndent`
		Use this command to move a local device to an application on another balena server.

		For example, you could provision a device against an openBalena installation
		where you perform end-to-end tests and then move it to balenaCloud when it's
		ready for production.

		To move a device between applications on the same server, use the
		\`balena device move\` command instead of \`balena join\`.

		If you don't specify a device hostname or IP, this command will automatically
		scan the local network for balenaOS devices and prompt you to select one
		from an interactive picker. This usually requires root privileges.

		Examples:

			$ balena join
			$ balena join balena.local
			$ balena join balena.local --application MyApp
			$ balena join 192.168.1.25
			$ balena join 192.168.1.25 --application MyApp
	`,
	options: [
		{
			signature: 'application',
			parameter: 'application',
			alias: 'a',
			description: 'The name of the application the device should join',
		},
	],

	permission: 'user',
	primary: true,

	async action(params, options, done) {
		const Logger = await import('../utils/logger');
		const promote = await import('../utils/promote');
		const sdk = getBalenaSdk();
		const logger = Logger.getLogger();
		return Bluebird.try(() => {
			return promote.join(logger, sdk, params.deviceIp, options.application);
		}).nodeify(done);
	},
};
