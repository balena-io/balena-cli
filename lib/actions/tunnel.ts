/*
Copyright 2019 Balena

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
import * as _ from 'lodash';
import { createServer, Server, Socket } from 'net';
import { isArray } from 'util';

import { getOnlineTargetUuid } from '../utils/patterns';
import { tunnelConnectionToDevice } from '../utils/tunnel';

interface Args {
	deviceOrApplication: string;
}

interface Options {
	port: string | string[];
}

class InvalidPortMappingError extends Error {
	constructor(mapping: string) {
		super(`'${mapping}' is not a valid port mapping.`);
	}
}

class NoPortsDefinedError extends Error {
	constructor() {
		super('No ports have been provided.');
	}
}

const isValidPort = (port: number) => {
	const MAX_PORT_VALUE = Math.pow(2, 16) - 1;
	return port > 0 && port <= MAX_PORT_VALUE;
};

export const tunnel: CommandDefinition<Args, Options> = {
	signature: 'tunnel <deviceOrApplication>',
	description: 'Tunnel local ports to your balenaOS device',
	help: stripIndent`
		Use this command to open local ports which tunnel to listening ports on your balenaOS device.

		For example, you could open port 8080 on your local machine to connect to your managed balenaOS
		device running a web server listening on port 3000.

		You can tunnel multiple ports at any given time.

		Examples:

			# map remote port 22222 to localhost:22222
			$ balena tunnel abcde12345 -p 22222

			# map remote port 22222 to localhost:222
			$ balena tunnel abcde12345 -p 22222:222

			# map remote port 22222 to any address on your host machine, port 22222
			$ balena tunnel abcde12345 -p 22222:0.0.0.0

			# map remote port 22222 to any address on your host machine, port 222
			$ balena tunnel abcde12345 -p 22222:0.0.0.0:222

			# multiple port tunnels can be specified at any one time
			$ balena tunnel abcde12345 -p 8080:3000 -p 8081:9000
	`,
	options: [
		{
			signature: 'port',
			parameter: 'port',
			alias: 'p',
			description: 'The mapping of remote to local ports.',
		},
	],

	primary: true,

	action: async (params, options) => {
		const Logger = await import('../utils/logger');
		const logger = new Logger();
		const balena = await import('balena-sdk');
		const sdk = balena.fromSharedOptions();

		const logConnection = (
			fromHost: string,
			fromPort: number,
			localAddress: string,
			localPort: number,
			deviceAddress: string,
			devicePort: number,
			err?: Error,
		) => {
			const logMessage = `${fromHost}:${fromPort} => ${localAddress}:${localPort} ===> ${deviceAddress}:${devicePort}`;

			if (err) {
				logger.logError(`${logMessage} :: ${err.message}`);
			} else {
				logger.logLogs(logMessage);
			}
		};

		if (options.port === undefined) {
			throw new NoPortsDefinedError();
		}

		const ports =
			typeof options.port !== 'string' && isArray(options.port)
				? (options.port as string[])
				: [options.port as string];

		const uuid = await getOnlineTargetUuid(sdk, params.deviceOrApplication);
		const device = await sdk.models.device.get(uuid);

		logger.logInfo(`Opening a tunnel to ${device.uuid}...`);

		const localListeners = _.chain(ports)
			.map(mapping => {
				const regexResult = /^([0-9]+)(?:$|\:(?:([\w\:\.]+)\:|)([0-9]+))$/.exec(
					mapping,
				);

				if (regexResult === null) {
					throw new InvalidPortMappingError(mapping);
				}

				// grab the groups
				// tslint:disable-next-line:prefer-const
				let [, remotePort, localAddress, localPort] = regexResult;

				if (
					!isValidPort(parseInt(localPort, undefined)) ||
					!isValidPort(parseInt(remotePort, undefined))
				) {
					throw new InvalidPortMappingError(mapping);
				}

				// default bind to localAddress
				if (localAddress == null) {
					localAddress = 'localhost';
				}

				// default use same port number locally as remote
				if (localPort == null) {
					localPort = remotePort;
				}

				return {
					localPort: parseInt(localPort, undefined),
					localAddress,
					remotePort: parseInt(remotePort, undefined),
				};
			})
			.map(({ localPort, localAddress, remotePort }) => {
				return tunnelConnectionToDevice(device.uuid, remotePort, sdk)
					.then(handler =>
						createServer((client: Socket) => {
							return handler(client)
								.then(() => {
									logConnection(
										client.remoteAddress || '',
										client.remotePort || 0,
										client.localAddress,
										client.localPort,
										device.vpn_address || '',
										remotePort,
									);
								})
								.catch(err =>
									logConnection(
										client.remoteAddress || '',
										client.remotePort || 0,
										client.localAddress,
										client.localPort,
										device.vpn_address || '',
										remotePort,
										err,
									),
								);
						}),
					)
					.then(
						server =>
							new Bluebird.Promise<Server>((resolve, reject) => {
								server.on('error', reject);
								server.listen(localPort, localAddress, () => {
									resolve(server);
								});
							}),
					)
					.then(() => {
						logger.logInfo(
							` - tunnelling ${localAddress}:${localPort} to ${
								device.uuid
							}:${remotePort}`,
						);

						return true;
					})
					.catch((err: Error) => {
						logger.logWarn(
							` - not tunnelling ${localAddress}:${localPort} to ${
								device.uuid
							}:${remotePort}, failed ${JSON.stringify(err.message)}`,
						);

						return false;
					});
			})
			.value();

		const results = await Promise.all(localListeners);
		if (!results.includes(true)) {
			throw new Error('No ports are valid for tunnelling');
		}

		logger.logInfo('Waiting for connections...');
	},
};
