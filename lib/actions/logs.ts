/*
Copyright 2016-2019 Balena

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

import { BalenaSDK } from 'balena-sdk';
import { CommandDefinition } from 'capitano';
import { stripIndent } from 'common-tags';

import { normalizeUuidProp } from '../utils/normalization';

type CloudLog =
	| {
			isSystem: false;
			serviceId: number;
			timestamp: number;
			message: string;
	  }
	| {
			isSystem: true;
			timestamp: number;
			message: string;
	  };

export const logs: CommandDefinition<
	{
		uuid: string;
	},
	{ tail: boolean }
> = {
	signature: 'logs <uuid>',
	description: 'show device logs',
	help: stripIndent`
		Use this command to show logs for a specific device.

		By default, the command prints all log messages and exit.

		To continuously stream output, and see new logs in real time, use the \`--tail\` option.

		Examples:

			$ balena logs 23c73a1
			$ balena logs 23c73a1`,
	options: [
		{
			signature: 'tail',
			description: 'continuously stream output',
			boolean: true,
			alias: 't',
		},
	],
	permission: 'user',
	primary: true,
	async action(params, options, done) {
		normalizeUuidProp(params);
		const balena = (await import('balena-sdk')).fromSharedOptions();
		const { serviceIdToName } = await import('../utils/cloud');
		const { displayLogObject } = await import('../utils/device/logs');
		const Logger = await import('../utils/logger');

		const logger = new Logger();

		const displayCloudLog = async (line: CloudLog) => {
			if (!line.isSystem) {
				let serviceName = await serviceIdToName(balena, line.serviceId);
				if (serviceName == null) {
					serviceName = 'Unknown service';
				}
				displayLogObject({ serviceName, ...line }, logger);
			} else {
				displayLogObject(line, logger);
			}
		};

		if (options.tail) {
			return balena.logs
				.subscribe(params.uuid, { count: 100 })
				.then(function(logStream) {
					logStream.on('line', displayCloudLog);
					logStream.on('error', done);
				})
				.catch(done);
		} else {
			return balena.logs
				.history(params.uuid)
				.each(displayCloudLog)
				.catch(done);
		}
	},
};
