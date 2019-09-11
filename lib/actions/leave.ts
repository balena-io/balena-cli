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

interface Args {
	deviceIp?: string;
}

export const leave: CommandDefinition<Args, {}> = {
	signature: 'leave [deviceIp]',
	description: 'Detach a local device from its balena application',
	help: stripIndent`
		Use this command to make a local device leave the balena server it is
		provisioned on. This effectively makes the device "unmanaged".

		The device entry on the server is preserved after running this command,
		so the device can subsequently re-join the server if needed.

		If you don't specify a device hostname or IP, this command will automatically
		scan the local network for balenaOS devices and prompt you to select one
		from an interactive picker. This usually requires root privileges.

		Examples:

			$ balena leave
			$ balena leave balena.local
			$ balena leave 192.168.1.25
	`,
	options: [],

	permission: 'user',
	primary: true,

	async action(params, _options, done) {
		const balena = await import('balena-sdk');
		const Logger = await import('../utils/logger');
		const promote = await import('../utils/promote');
		const sdk = balena.fromSharedOptions();
		const logger = Logger.getLogger();
		return Bluebird.try(() => {
			return promote.leave(logger, sdk, params.deviceIp);
		}).nodeify(done);
	},
};
