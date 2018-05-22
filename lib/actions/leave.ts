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

export const leave: CommandDefinition<Args, {}> = {
	signature: 'leave [deviceIp]',
	description: 'Detach a local device from its resin.io application',
	help: stripIndent`
		Examples:

			$ resin leave
			$ resin leave resin.local
			$ resin leave 192.168.1.25
	`,
	options: [],

	permission: 'user',
	primary: true,

	async action(params, _options, done) {
		const resin = await import('resin-sdk');
		const Logger = await import('../utils/logger');
		const promote = await import('../utils/promote');
		const sdk = resin.fromSharedOptions();
		const logger = new Logger();
		return Bluebird.try(() => {
			return promote.leave(logger, sdk, params.deviceIp);
		}).nodeify(done);
	},
};
