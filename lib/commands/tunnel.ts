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

import { flags } from '@oclif/command';
import Command from '../command';
import {
	NoPortsDefinedError,
	InvalidPortMappingError,
	ExpectedError,
} from '../errors';
import * as cf from '../utils/common-flags';
import { getBalenaSdk, stripIndent } from '../utils/lazy';
import { lowercaseIfSlug } from '../utils/normalization';

import type { Server, Socket } from 'net';

interface FlagsDef {
	port: string[];
	help: void;
}

interface ArgsDef {
	deviceOrFleet: string;
}

export default class TunnelCmd extends Command {
	public static description = stripIndent`
		Tunnel local ports to your balenaOS device.

		Use this command to open local TCP ports that tunnel to listening sockets in a
		balenaOS device.

		For example, this command could be used to expose the ssh server of a balenaOS
		device (port number 22222) on the local machine, or to expose a web server
		running on the device. The port numbers do not have be the same between the
		device and the local machine, and multiple ports may be tunneled in a single
		command line.

		Port mappings are specified in the format: <remotePort>[:[localIP:]localPort]
		localIP defaults to 'localhost', and localPort defaults to the specified
		remotePort value.

		Note: the -p (--port) flag must be provided at the end of the command line,
		as per examples.

		In the case of openBalena, the tunnel command in CLI v12.38.5 or later requires
		openBalena v3.1.2 or later. Older CLI versions work with older openBalena
		versions.
	`;

	public static examples = [
		'# map remote port 22222 to localhost:22222',
		'$ balena tunnel myFleet -p 22222',
		'',
		'# map remote port 22222 to localhost:222',
		'$ balena tunnel 2ead211 -p 22222:222',
		'',
		'# map remote port 22222 to any address on your host machine, port 22222',
		'$ balena tunnel 1546690 -p 22222:0.0.0.0',
		'',
		'# map remote port 22222 to any address on your host machine, port 222',
		'$ balena tunnel myFleet -p 22222:0.0.0.0:222',
		'',
		'# multiple port tunnels can be specified at any one time',
		'$ balena tunnel myFleet -p 8080:3000 -p 8081:9000',
	];

	public static args = [
		{
			name: 'deviceOrFleet',
			description: 'device UUID or fleet name/slug',
			required: true,
			parse: lowercaseIfSlug,
		},
	];

	public static usage = 'tunnel <deviceOrFleet>';

	public static flags: flags.Input<FlagsDef> = {
		port: flags.string({
			description:
				'port mapping in the format <remotePort>[:[localIP:]localPort]',
			char: 'p',
			multiple: true,
		}),
		help: cf.help,
	};

	public static primary = true;
	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			TunnelCmd,
		);

		const logger = await Command.getLogger();
		const sdk = getBalenaSdk();

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

		// Ascertain device uuid
		const { getOnlineTargetDeviceUuid } = await import('../utils/patterns');
		const uuid = await getOnlineTargetDeviceUuid(sdk, params.deviceOrFleet);
		logger.logInfo(`Opening a tunnel to ${uuid}...`);

		const _ = await import('lodash');
		const localListeners = _.chain(options.port)
			.map((mapping) => {
				return this.parsePortMapping(mapping);
			})
			.map(async ({ localPort, localAddress, remotePort }) => {
				try {
					const { tunnelConnectionToDevice } = await import('../utils/tunnel');
					const handler = await tunnelConnectionToDevice(uuid, remotePort, sdk);

					const { createServer } = await import('net');
					const server = createServer(async (client: Socket) => {
						try {
							await handler(client);
							logConnection(
								client.remoteAddress || '',
								client.remotePort || 0,
								client.localAddress,
								client.localPort,
								uuid,
								remotePort,
							);
						} catch (err) {
							logConnection(
								client.remoteAddress || '',
								client.remotePort || 0,
								client.localAddress,
								client.localPort,
								uuid,
								remotePort,
								err,
							);
						}
					});

					await new Promise<Server>((resolve, reject) => {
						server.on('error', reject);
						server.listen(localPort, localAddress, () => {
							resolve(server);
						});
					});

					logger.logInfo(
						` - tunnelling ${localAddress}:${localPort} to ${uuid}:${remotePort}`,
					);

					return true;
				} catch (err) {
					logger.logWarn(
						` - not tunnelling ${localAddress}:${localPort} to ${uuid}:${remotePort}, failed ${JSON.stringify(
							err.message,
						)}`,
					);

					return false;
				}
			})
			.value();

		const results = await Promise.all(localListeners);
		if (!results.includes(true)) {
			throw new ExpectedError('No ports are valid for tunnelling');
		}

		logger.logInfo('Waiting for connections...');
	}

	/**
	 * Parse a port mapping specification string in the format:
	 *  <remotePort>[:[localIP:]localPort]
	 * @param portMapping
	 */
	parsePortMapping(portMapping: string) {
		const mappingElements = portMapping.split(':');

		let localAddress = 'localhost';

		// First element is always remotePort
		const remotePort = parseInt(mappingElements[0], undefined);
		let localPort = remotePort;

		if (mappingElements.length === 2) {
			// [1] could be localAddress or localPort
			if (/^\d+$/.test(mappingElements[1])) {
				localPort = parseInt(mappingElements[1], undefined);
			} else {
				localAddress = mappingElements[1];
			}
		} else if (mappingElements.length === 3) {
			// [1] is localAddress, [2] is localPort
			localAddress = mappingElements[1];
			localPort = parseInt(mappingElements[2], undefined);
		} else if (mappingElements.length > 3) {
			throw new InvalidPortMappingError(portMapping);
		}

		// Validate results
		if (!this.isValidPort(remotePort) || !this.isValidPort(localPort)) {
			throw new InvalidPortMappingError(portMapping);
		}

		return { remotePort, localAddress, localPort };
	}

	isValidPort(port: number) {
		const MAX_PORT_VALUE = Math.pow(2, 16) - 1;
		return port > 0 && port <= MAX_PORT_VALUE;
	}
}
