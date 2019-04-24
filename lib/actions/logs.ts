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
		uuidOrDevice: string;
	},
	{
		tail: boolean;
		service: string;
		system: boolean;
	}
> = {
	signature: 'logs <uuidOrDevice>',
	description: 'show device logs',
	help: stripIndent`
		Use this command to show logs for a specific device.

		By default, the command prints all log messages and exits.

		To continuously stream output, and see new logs in real time, use the \`--tail\` option.

		If an IP address is passed to this command, logs are displayed from
		a local mode device with that address. Note that --tail is implied
		when this command is provided an IP address.

		Logs from a single service can be displayed with the --service flag. Just system logs
		can be shown with the --system flag. Note that these flags can be used together.

		Examples:

			$ balena logs 23c73a1
			$ balena logs 23c73a1 --tail
			$ balena logs 23c73a1 --service my-service

			$ balena logs 192.168.0.31
			$ balena logs 192.168.0.31 --service my-service
			$ balena logs 192.168.0.31 --system
			$ balena logs 192.168.0.31 --system --service my-service`,
	options: [
		{
			signature: 'tail',
			description: 'continuously stream output',
			boolean: true,
			alias: 't',
		},
		{
			signature: 'service',
			description:
				'Only show logs for a single service. This can be used in combination with --system',
			parameter: 'service',
			alias: 's',
		},
		{
			signature: 'system',
			alias: 'S',
			boolean: true,
			description:
				'Only show system logs. This can be used in combination with --service.',
		},
	],
	permission: 'user',
	primary: true,
	async action(params, options, done) {
		normalizeUuidProp(params);
		const balena = (await import('balena-sdk')).fromSharedOptions();
		const { serviceIdToName } = await import('../utils/cloud');
		const { displayDeviceLogs, displayLogObject } = await import(
			'../utils/device/logs'
		);
		const { validateIPAddress } = await import('../utils/validation');
		const { exitWithExpectedError } = await import('../utils/patterns');
		const Logger = await import('../utils/logger');

		const logger = new Logger();

		const displayCloudLog = async (line: CloudLog) => {
			if (!line.isSystem) {
				let serviceName = await serviceIdToName(balena, line.serviceId);
				if (serviceName == null) {
					serviceName = 'Unknown service';
				}
				displayLogObject(
					{ serviceName, ...line },
					logger,
					options.system || false,
					options.service,
				);
			} else {
				displayLogObject(
					line,
					logger,
					options.system || false,
					options.service,
				);
			}
		};

		if (validateIPAddress(params.uuidOrDevice)) {
			const { DeviceAPI } = await import('../utils/device/api');
			const deviceApi = new DeviceAPI(logger, params.uuidOrDevice);
			logger.logDebug('Checking we can access device');
			try {
				await deviceApi.ping();
			} catch (e) {
				exitWithExpectedError(
					new Error(
						`Cannot access local mode device at address ${params.uuidOrDevice}`,
					),
				);
			}

			const logStream = await deviceApi.getLogStream();
			displayDeviceLogs(
				logStream,
				logger,
				options.system || false,
				options.service,
			);
		} else {
			if (options.tail) {
				return balena.logs
					.subscribe(params.uuidOrDevice, { count: 100 })
					.then(function(logStream) {
						logStream.on('line', displayCloudLog);
						logStream.on('error', done);
					})
					.catch(done);
			} else {
				return balena.logs
					.history(params.uuidOrDevice)
					.each(displayCloudLog)
					.catch(done);
			}
		}
	},
};
