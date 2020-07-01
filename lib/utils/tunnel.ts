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
import type { BalenaSDK } from 'balena-sdk';
import { Socket } from 'net';
import { TypedError } from 'typed-error';

const PROXY_CONNECT_TIMEOUT_MS = 10000;

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

export const tunnelConnectionToDevice = (
	uuid: string,
	port: number,
	sdk: BalenaSDK,
) => {
	return Promise.all([
		sdk.settings.get('vpnUrl'),
		sdk.auth.whoami(),
		sdk.auth.getToken(),
	]).then(([vpnUrl, whoami, token]) => {
		const auth = {
			user: whoami || 'root',
			password: token,
		};

		return (client: Socket): Promise<void> =>
			openPortThroughProxy(vpnUrl, 3128, auth, uuid, port)
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
		const proxyTunnel = new Socket();
		proxyTunnel.on('error', reject);
		proxyTunnel.connect(proxyPort, proxyServer, () => {
			const proxyConnectionHandler = (data: Buffer) => {
				proxyTunnel.removeListener('data', proxyConnectionHandler);
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
			};

			proxyTunnel.on('timeout', () => {
				reject(new RemoteSocketNotListening(devicePort));
			});
			proxyTunnel.on('data', proxyConnectionHandler);
			proxyTunnel.setTimeout(PROXY_CONNECT_TIMEOUT_MS);
			proxyTunnel.write(httpHeaders.join('\r\n').concat('\r\n\r\n'));
		});
	});
};
