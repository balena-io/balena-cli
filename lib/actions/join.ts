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
import * as Bluebird from 'bluebird';
import { CommandDefinition } from 'capitano';
import { stripIndent } from 'common-tags';

interface Args {
	deviceIp?: string;
}

interface Options {
	application?: string;
}

export const join: CommandDefinition<Args, Options> = {
	signature: 'join [deviceIp]',
	description:
		'Promote a local device running unmanaged resinOS to join a resin.io application',
	help: stripIndent`
		Examples:

			$ resin join
			$ resin join resin.local
			$ resin join resin.local --application MyApp
			$ resin join 192.168.1.25
			$ resin join 192.168.1.25 --application MyApp
	`,
	options: [
		{
			signature: 'application',
			parameter: 'application',
			alias: 'a',
			description: 'The name of the application the device should join',
		},
	],

	primary: true,

	async action(params, options, done) {
		const resin = await import('resin-sdk');
		const Logger = await import('../utils/logger');
		const promote = await import('../utils/promote');
		const sdk = resin.fromSharedOptions();
		const logger = new Logger();
		return Bluebird.try(() => {
			return promote.join(logger, sdk, params.deviceIp, options.application);
		}).nodeify(done);
	},
};
