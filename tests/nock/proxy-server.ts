/**
 * @license
 * Copyright 2020 Balena Ltd.
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

/**
 * This module creates two HTTP servers listening on the local machine:
 * * The "proxy server" which is a standard HTTP proxy server that handles the
 *   CONNECT HTTP verb, using the `http-proxy` dependency.
 * * The "interceptor server" which actually handles the proxied requests.
 *
 * The proxy server proxies the client request to the interceptor server. (This
 * two-server approach (proxy + interceptor) is mainly a result of accommodating
 * the typical setup documented by the `http-proxy` dependency.)
 *
 * The use case for these servers is to test the standalone executable (CLI's
 * standalone zip package) in a child process. Most of the CLI's automated tests
 * currently test HTTP requests using `nock`, but `nock` can only mock/test the
 * same process (Node's built-in `http` library). However, the CLI has support
 * for proxy servers as a product feature, so the idea was to proxy the child
 * process requests to the parent process, where the proxy / interceptor servers
 * run. The interceptor server then forwards the request (mostly unchanged) with
 * the expectation that `nock` will intercept the requests for testing (in the
 * parent process) as usual.
 *
 * 1. A `mocha` test case calls `runCommand('push test-rpi')`, with `nock` setup
 *    to intercept HTTP requests (in the same process that runs `mocha`).
 * 2. The proxy and interceptor servers are started in the parent process (only
 *    once: singleton) at free TCP port numbers randomly allocated by the OS.
 * 3. A CLI child process gets spawned to run the command (`balena push test-rpi`)
 *    with environment variables including BALENARC_PROXY (set to
 *    'http://127.0.0.1:${proxyPort}'). (Additional env vars instruct the
 *    child process to use HTTP instead of HTTPS for the balena API and builder.)
 * 4. The child process sends the HTTP requests to the proxy server.
 * 5. The proxy server forwards the request to the interceptor server.
 * 6. The interceptor server simply re-issues the HTTP request (unchange), with
 *    the expectation that `nock` will intercept it.
 * 7. `nock` (running on the parent process, same process that runs `mocha`)
 *    intercepts the HTTP request, test it and replies with a mocked response.
 * 8. `nocks` response is returned to the interceptor server, which returns it
 *    to the proxy server, which returns it to the child process, which continues
 *    CLI command execution.
 */

import * as http from 'http';
import httpProxy from 'http-proxy';

const proxyServers: http.Server[] = [];

after(function () {
	if (proxyServers.length) {
		if (process.env.DEBUG) {
			console.error(
				`[debug] Closing proxy servers (count=${proxyServers.length})`,
			);
		}
		proxyServers.forEach((s) => s.close());
		proxyServers.splice(0);
	}
});

export let proxyServerPort = 0;
export let interceptorServerPort = 0;

export async function createProxyServerOnce(): Promise<[number, number]> {
	if (proxyServerPort === 0) {
		[proxyServerPort, interceptorServerPort] = await createProxyServer();
	}
	return [proxyServerPort, interceptorServerPort];
}

async function createProxyServer(): Promise<[number, number]> {
	const interceptorPort = await createInterceptorServer();

	const proxy = httpProxy.createProxyServer();
	proxy.on('error', function (err, _req, res, _target) {
		(res as http.ServerResponse).writeHead(500, {
			'Content-Type': 'text/plain',
		});
		const msg = `Proxy server error: ${err}`;
		console.error(msg);
		res.end(msg);
	});

	const server = http.createServer(function (
		req: http.IncomingMessage,
		res: http.ServerResponse,
	) {
		if (process.env.DEBUG) {
			console.error(`[debug] Proxy forwarding for ${req.url}`);
		}
		proxy.web(req, res, { target: `http://127.0.0.1:${interceptorPort}` });
	});
	proxyServers.push(server);

	server.on('error', (err: Error) => {
		console.error(`Proxy server error (http.createServer):\n${err}`);
	});

	let proxyPort = 0; // TCP port number, 0 means automatic allocation

	await new Promise<void>((resolve, reject) => {
		// TODO: remove 'as any' below. According to @types/node v16.18.25, the
		// callback type is `() => void`, but our code assumes `(err: Error) => void`
		const listener = (server.listen as any)(0, '127.0.0.1', (err: Error) => {
			if (err) {
				console.error(`Error starting proxy server:\n${err}`);
				reject(err);
			} else {
				const info: any = listener.address();
				proxyPort = info.port;
				console.error(
					`[Info] Proxy server listening on ${info.address}:${proxyPort}`,
				);
				resolve();
			}
		});
	});

	return [proxyPort, interceptorPort];
}

async function createInterceptorServer(): Promise<number> {
	const url = await import('url');

	const server = http.createServer();
	proxyServers.push(server);

	server
		.on('error', (err: Error) => {
			console.error(`Interceptor server error: ${err}`);
		})
		.on(
			'request',
			(cliReq: http.IncomingMessage, cliRes: http.ServerResponse) => {
				const proxiedFor = `http://${cliReq.headers.host}${cliReq.url}`;
				if (process.env.DEBUG) {
					console.error(`[debug] Interceptor forwarding for ${proxiedFor}`);
				}
				const parsed = url.parse(proxiedFor);
				const { hash, hostname, path: urlPath } = parsed;
				let { port, protocol } = parsed;
				protocol = (protocol || 'http:').toLowerCase();
				port = port || (protocol === 'https:' ? '443' : '80');
				const reqOpts = {
					protocol,
					port,
					host: hostname,
					path: `${urlPath || ''}${hash || ''}`,
					method: cliReq.method,
					headers: cliReq.headers,
				};
				const srvReq = http.request(reqOpts);
				srvReq
					.on('error', (err) => {
						console.error(
							`Interceptor server error in onward request:\n${err}`,
						);
					})
					.on('response', (srvRes: http.IncomingMessage) => {
						// Copy headers, status code and status message from interceptor to client
						for (const [key, val] of Object.entries(srvRes.headers)) {
							if (key && val) {
								cliRes.setHeader(key, val);
							}
						}
						cliRes.statusCode = srvRes.statusCode || cliRes.statusCode;
						cliRes.statusMessage = srvRes.statusMessage || cliRes.statusMessage;
						srvRes.pipe(cliRes).on('error', (err: Error) => {
							console.error(
								`Interceptor server error piping response to proxy server:\n${err}`,
							);
							cliRes.end();
						});
					});
				cliReq.pipe(srvReq).on('error', (err: Error) => {
					console.error(
						`Proxy server error piping client request onward:\n${err}`,
					);
				});
			},
		);

	let interceptorPort = 0;

	await new Promise<void>((resolve, reject) => {
		// TODO: remove 'as any' below. According to @types/node v16.18.25, the
		// callback type is `() => void`, but our code assumes `(err: Error) => void`
		const listener = (server.listen as any)(0, '127.0.0.1', (err: Error) => {
			if (err) {
				console.error(`Error starting interceptor server:\n${err}`);
				reject(err);
			} else {
				const info: any = listener.address();
				interceptorPort = info.port;
				console.error(
					`[Info] Interceptor server listening on ${info.address}:${interceptorPort}`,
				);
				resolve();
			}
		});
	});

	return interceptorPort;
}
