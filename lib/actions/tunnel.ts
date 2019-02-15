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
import * as _ from 'lodash';
import { CommandDefinition } from 'capitano';
import { stripIndent } from 'common-tags';
import { isArray } from 'util';
import { createServer } from 'net';
import { tunnelConnectionToDevice } from '../utils/tunnel';

interface Args {
	uuid: string;
}

interface Options {
	port: string | string[];
}

class InvalidPortMappingError extends Error {
	constructor(mapping: string) {
		super(`'${mapping}' is not a valid port mapping.`);
	}
}

export const tunnel: CommandDefinition<Args, Options> = {
	signature: 'tunnel [uuid]',
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

	async action(params, options, done) {
		const Logger = await import('../utils/logger');
		const logger = new Logger();
		const balena = await import('balena-sdk');
		const sdk = balena.fromSharedOptions();
		return Bluebird.try(() => {
			logger.logInfo(`Tunnel to ${params.uuid}`);

			const ports =
				typeof options.port !== 'string' && isArray(options.port)
					? (options.port as string[])
					: [options.port as string];

			const localListeners = _.chain(ports)
				.map(mapping => {
					const regexResult = /^([0-9]+)(?:$|\:(?:([\w\:\.]+)\:|)([0-9]+))$/.exec(
						mapping,
					);

					if (regexResult === null) {
						throw new InvalidPortMappingError(mapping);
					}

					// grab the groups
					let [, remotePort, localHost, localPort] = regexResult;

					// default bind to localhost
					if (localHost == undefined) {
						localHost = 'localhost';
					}

					// default use same port number locally as remote
					if (localPort == undefined) {
						localPort = remotePort;
					}

					return {
						localPort: parseInt(localPort),
						localHost,
						remotePort: parseInt(remotePort),
					};
				})
				.map(({ localPort, localHost, remotePort }) => {
					return tunnelConnectionToDevice(params.uuid, remotePort, sdk)
						.then(handler => {
							logger.logInfo(
								`- tunnelling ${localHost}:${localPort} to remote:${remotePort}`,
							);
							return createServer(handler)
								.on('connection', connection => {
									logger.logLogs(
										`[${new Date().toISOString()}] => ${
											connection.remotePort
										} => ${
											connection.localAddress
										}:${localPort} => ${remotePort}`,
									);
								})
								.on('error', err => {
									console.error(err);
									throw err;
								})
								.listen(localPort, localHost);
						})
						.catch((err: Error) => {
							console.error(err);
						});
				})
				.value();

			return Bluebird.all(localListeners).then(() => {
				logger.logInfo('Waiting for connections...');
			});
		}).nodeify(done);
	},
};
