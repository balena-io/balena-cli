/*
Copyright 2018 Balena Ltd.

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

import * as sdk from 'balena-sdk';
import * as Bluebird from 'bluebird';
import * as globalTunnel from 'global-tunnel-ng';
import * as _ from 'lodash';
import * as net from 'net';
import * as ssh2 from 'ssh2';
import * as stream from 'stream';

const balena = sdk.fromSharedOptions();

const tunnelViaSocket = (
	socket: net.Socket,
	host: string,
	port: number,
	proxyAuth?: Buffer,
): Bluebird<net.Socket> =>
	new Bluebird((resolve, reject) => {
		let tunnelProxyResponse = '';
		socket.write(`CONNECT ${host}:${port} HTTP/1.0\r\n`);
		if (proxyAuth != null) {
			socket.write(
				`Proxy-Authorization: Basic ${proxyAuth.toString('base64')}\r\n`,
			);
		}
		socket.write('\r\n');

		const earlyEnd = () => {
			console.error(
				`Could not connect to ${host}:${port} tunneling socket closed prematurely.`,
			);
			reject(
				new Error(
					`Could not connect to ${host}:${port} tunneling socket closed prematurely.`,
				),
			);
		};
		const earlyError = (err: Error) => {
			let errMsg = 'Could not connect to VPN tunnel';
			if (err != null && err.message) {
				errMsg += `: ${err.message}`;
			}
			console.error(errMsg);
			reject(new Error(errMsg));
		};
		const proxyData = (chunk: Buffer) => {
			if (chunk != null) {
				tunnelProxyResponse += chunk.toString();
			}

			// read 'data' chunks until full HTTP status line has been read
			if (!_.includes(tunnelProxyResponse, '\r\n\r\n')) {
				return;
			}
			socket.removeListener('data', proxyData);
			socket.removeListener('end', earlyEnd);
			socket.removeListener('error', earlyError);

			// RFC2616: Status-Line = HTTP-Version SP Status-Code SP Reason-Phrase CRLF
			let httpStatusLine = tunnelProxyResponse.split('\r\n')[0];
			const httpStatusCode = parseInt(httpStatusLine.split(' ')[1], 10);

			// translate "Proxy-authorization required" to more user-friendly "Forbidden"
			if (httpStatusCode === 407) {
				httpStatusLine = 'HTTP/1.0 403 Forbidden';
			}

			if (httpStatusCode !== 200) {
				console.error(
					`Could not connect to ${host}:${port} - ${httpStatusLine}`,
				);
				return reject(
					new Error(`Could not connect to ${host}:${port} - ${httpStatusLine}`),
				);
			}

			// one proxied socket, ready to go!
			resolve(socket);
		};

		socket
			.on('end', earlyEnd)
			.on('error', earlyError)
			.on('data', proxyData);
	});

Bluebird.promisifyAll(ssh2.Client);

interface Ssh2ClientAsync extends ssh2.Client {
	execAsync(
		cmd: string,
		options?: ssh2.ExecOptions,
	): Bluebird<ssh2.ClientChannel>;
}

const createSSHClient = (socket: stream.Duplex): Bluebird<Ssh2ClientAsync> =>
	new Bluebird((resolve, reject) => {
		const client = new ssh2.Client() as Ssh2ClientAsync;
		return client
			.on('ready', () => {
				resolve(client);
			})
			.on('error', err => {
				const errSource = err && err.level ? 'ssh client socket' : 'ssh client';
				let errMsg = `${errSource} error while initiating SSH connection`;
				if (err && err.description) {
					errMsg += `: ${err.description}`;
				}
				console.error(errMsg);
				reject(new Error(errMsg));
			})
			.connect({
				sock: socket,
				username: 'root',
				port: 22222,
				agent: process.env.SSH_AUTH_SOCK,
			});
	});

const createSSHClientDisposer = (
	socket: stream.Duplex,
): Bluebird.Disposer<Ssh2ClientAsync> =>
	createSSHClient(socket).disposer((client: Ssh2ClientAsync) => client.end());

interface ExecResponse {
	code: number;
	data?: {
		stdout: string;
		stderr: string;
	};
	signal?: string;
}

const pipeDeviceToStdout = (
	deviceStream: ssh2.ClientChannel,
): Bluebird<ExecResponse> => {
	const dsResize = () =>
		deviceStream.setWindow(process.stdout.rows!, process.stdout.columns!, 0, 0);
	const dsEnd = () => deviceStream.end();
	const dsWrite = (data: Buffer) => deviceStream.write(data);

	if (process.stdin != null && process.stdout.isTTY) {
		if (typeof process.stdin.setRawMode === 'function') {
			process.stdin.setRawMode(true);
		}

		// Set initial window size and handle resize events
		dsResize();
		process.stdout.on('resize', dsResize);
	}

	return new Bluebird((resolve, reject) => {
		const errorHandler = (err: Error) => {
			console.error(err);
			reject(err);
		};

		deviceStream
			.on('data', (data: string) => process.stdout.write(data))
			.on('end', () => {
				process.stdin.removeListener('data', dsWrite);
				process.stdin.removeListener('end', dsEnd);
				process.stdin.removeListener('close', dsEnd);
			})
			.on('close', (code: number, signal: string) => resolve({ code, signal }))
			.stderr.on('data', (data: string) => process.stderr.write(data))
			.on('error', errorHandler);

		process.stdin
			.on('data', dsWrite)
			// make sure that the device-side stream is properly closed if userStream ends first
			.on('end', dsEnd)
			.on('close', dsEnd)
			.on('error', errorHandler);
	});
};

const createCommandPipe = (param: {
	cmd: string;
	socket: net.Socket;
}): Bluebird<ExecResponse> =>
	Bluebird.using(createSSHClientDisposer(param.socket), client =>
		client
			.execAsync(param.cmd, { pty: process.stdout.isTTY })
			.then(pipeDeviceToStdout),
	);

const getCommand = (containerId?: string): string => {
	if (containerId != null) {
		return `exec "$(find /usr/bin/{balena{-machine,},docker,rce} 2>/dev/null | head -1)" exec -it ${containerId} /bin/sh -c 'test -x /bin/bash && exec /bin/bash -l || exec /bin/sh -l'`;
	} else {
		return 'test -x /bin/bash && exec /bin/bash -l || exec /bin/sh -l';
	}
};

// NOTE: this function assumes the appropriate vetting has been done in `./ssh.ts`
export const connect = async (
	uuid: string,
	containerId: string | undefined,
	useProxy: boolean,
) => {
	const authToken = await balena.auth.getToken();
	const balenaUrl = await balena.settings.get('balenaUrl');
	const vpnHostname = `vpn.${balenaUrl}`;
	let socket: net.Socket;
	if (useProxy) {
		const sock = net.connect(
			globalTunnel.proxyConfig!.port,
			globalTunnel.proxyConfig!.host,
		);
		let proxyAuth: Buffer | undefined;
		if (globalTunnel.proxyConfig!.proxyAuth != null) {
			proxyAuth = Buffer.from(globalTunnel.proxyConfig!.proxyAuth!);
		}
		socket = await tunnelViaSocket(sock, vpnHostname, 3128, proxyAuth);
	} else {
		socket = net.connect(3128, vpnHostname);
	}
	socket = await tunnelViaSocket(
		socket,
		`${uuid}.balena`,
		22222,
		Buffer.from(authToken),
	);
	const { code } = await createCommandPipe({
		cmd: getCommand(containerId),
		socket,
	});
	process.exit(code);
};
