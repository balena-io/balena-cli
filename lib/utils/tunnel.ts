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
import type { BalenaSDK, Device } from 'balena-sdk';
import { Server, Socket } from 'net';
import * as tls from 'tls';
import { TypedError } from 'typed-error';
import { ExpectedError } from '../errors';
import Logger = require('./logger');

const PROXY_CONNECT_TIMEOUT_MS = 10000;

class TunnelServerNotTrustedError extends ExpectedError {}

class UnableToConnectError extends TypedError {
	public status: string;
	public statusCode: string;
	constructor(statusCode: string, status: string) {
		super(`Unable to connect: ${statusCode} ${status}`);
		this.status = status;
		this.statusCode = statusCode;
	}
}

class RemoteSocketNotListening extends TypedError {
	public port: number;
	constructor(port: number) {
		super(`Device is not listening on port ${port}`);
	}
}

export const logConnection = (
	logger: Logger,
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

export const openTunnel = async (
	logger: Logger,
	device: Device,
	sdk: BalenaSDK,
	localPort: number,
	localAddress: string,
	remotePort: number,
) => {
	try {
		const handler = await tunnelConnectionToDevice(
			device.uuid,
			remotePort,
			sdk,
		);

		const { createServer } = await import('net');
		const server = createServer(async (client: Socket) => {
			try {
				await handler(client);
				logConnection(
					logger,
					client.remoteAddress || '',
					client.remotePort || 0,
					client.localAddress,
					client.localPort,
					device.vpn_address || '',
					remotePort,
				);
			} catch (err: any) {
				logConnection(
					logger,
					client.remoteAddress || '',
					client.remotePort || 0,
					client.localAddress,
					client.localPort,
					device.vpn_address || '',
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
			` - tunnelling ${localAddress}:${localPort} to ${device.uuid}:${remotePort}`,
		);

		return true;
	} catch (err: any) {
		logger.logWarn(
			` - tunnel failed ${localAddress}:${localPort} to ${
				device.uuid
			}:${remotePort}, failed ${JSON.stringify(err.message)}`,
		);

		return false;
	}
};

export const tunnelConnectionToDevice = (
	uuid: string,
	port: number,
	sdk: BalenaSDK,
) => {
	return Promise.all([
		sdk.settings.get('tunnelUrl'),
		sdk.auth.whoami(),
		sdk.auth.getToken(),
	]).then(([tunnelUrl, whoami, token]) => {
		const auth = {
			user: whoami || 'root',
			password: token,
		};

		return (client: Socket): Promise<void> =>
			openPortThroughProxy(tunnelUrl, 443, auth, uuid, port)
				.then((remote) => {
					client.pipe(remote);
					remote.pipe(client);
					remote.on('error', (err) => {
						console.error('Remote: ' + err);
						client.end();
					});
					client.on('error', (err) => {
						console.error('Client: ' + err);
						remote.end();
					});
					remote.on('close', () => {
						client.end();
					});
					client.on('close', () => {
						remote.end();
					});
				})
				.catch((e) => {
					client.end();
					throw e;
				});
	});
};

const openPortThroughProxy = (
	proxyServer: string,
	proxyPort: number,
	proxyAuth: { user: string; password: string } | null,
	deviceUuid: string,
	devicePort: number,
) => {
	const httpHeaders = [`CONNECT ${deviceUuid}.balena:${devicePort} HTTP/1.0`];

	if (proxyAuth !== null) {
		const credentials = Buffer.from(
			`${proxyAuth.user}:${proxyAuth.password}`,
		).toString('base64');

		httpHeaders.push(`Proxy-Authorization: Basic ${credentials}`);
	}

	return new Promise<Socket>((resolve, reject) => {
		const proxyTunnel = tls.connect(
			proxyPort,
			proxyServer,
			{ servername: proxyServer }, // send the hostname in the SNI field
			() => {
				if (!proxyTunnel.authorized) {
					console.error('Unable to authorize the tunnel server');
					reject(
						new TunnelServerNotTrustedError(proxyTunnel.authorizationError),
					);
					return;
				}

				proxyTunnel.once('data', (data: Buffer) => {
					const [httpStatus] = data.toString('utf8').split('\r\n');
					const [, httpStatusCode, ...httpMessage] = httpStatus.split(' ');

					if (parseInt(httpStatusCode, 10) === 200) {
						proxyTunnel.setTimeout(0);
						resolve(proxyTunnel);
					} else {
						reject(
							new UnableToConnectError(httpStatusCode, httpMessage.join(' ')),
						);
					}
				});

				proxyTunnel.on('timeout', () => {
					reject(new RemoteSocketNotListening(devicePort));
				});

				proxyTunnel.setTimeout(PROXY_CONNECT_TIMEOUT_MS);
				proxyTunnel.write(httpHeaders.join('\r\n').concat('\r\n\r\n'));
			},
		);
		proxyTunnel.on('error', reject);
	});
};
