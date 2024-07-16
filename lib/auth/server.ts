/*
Copyright 2016-2020 Balena

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

import bodyParser from 'body-parser';
import { EventEmitter } from 'events';
import express from 'express';
import type { Socket } from 'net';
import * as path from 'path';

import * as utils from './utils.js';
import { ExpectedError } from '../errors.js';

export class LoginServer extends EventEmitter {
	protected expressApp: express.Express;
	protected server: import('net').Server;
	protected serverSockets: Socket[] = [];
	protected firstError: Error;
	protected token: string;

	public readonly loginPath = '/auth';

	/**
	 * Start the HTTP server, listening on the given IP address and port number.
	 * If the port number is 0, the OS will allocate a free port number.
	 */
	public async start({ host = '127.0.0.1', port = 0 } = {}): Promise<{
		host: string;
		port: number;
		urlPath: string;
	}> {
		this.once('error', (err: Error) => {
			this.firstError = err;
		});
		this.on('token', (token: string) => {
			this.token = token;
		});

		const app = (this.expressApp = express());
		app.use(
			bodyParser.urlencoded({
				extended: true,
			}),
		);

		app.set('view engine', 'ejs');
		app.set('views', path.join(import.meta.dirname, 'pages'));

		this.server = await new Promise<import('net').Server>((resolve, reject) => {
			const callback = (err: Error) => {
				if (err) {
					this.emit('error', err);
					reject(err);
				} else {
					resolve(server);
				}
			};
			const server = app.listen(port, host, callback as any);
			server.on('connection', (socket) => this.serverSockets.push(socket));
		});

		this.expressApp.post(this.loginPath, async (request, response) => {
			this.server.close(); // stop listening for new connections
			try {
				const token = request.body.token?.trim();
				if (!token) {
					throw new ExpectedError('No token');
				}
				const loggedIn = await utils.loginIfTokenValid(token);
				if (!loggedIn) {
					throw new ExpectedError('Invalid token');
				}
				this.emit('token', token);
				response.status(200).render('success');
			} catch (error) {
				this.emit('error', error);
				response.status(401).render('error');
			}
		});

		this.expressApp.use((_request, response) => {
			this.server.close(); // stop listening for new connections
			this.emit('error', new Error('Unknown path or verb'));
			response.status(404).send('Not found');
		});

		return this.getAddress();
	}

	public getAddress(): { host: string; port: number; urlPath: string } {
		const info = this.server.address() as import('net').AddressInfo;
		return {
			host: info.address,
			port: info.port,
			urlPath: this.loginPath,
		};
	}

	/**
	 * Shut the server down.
	 * Call this method to avoid the process hanging in some situations.
	 */
	public shutdown() {
		// A Node.js `http.server` instance prevents the process from exiting for up to
		// 2 minutes (by default) if a client keeps a HTTP connection open, and regardless
		// of whether `server.close()` was called: the `server.close(callback)` callback
		// takes just as long to complete. Setting `server.timeout` to some value like
		// 3 seconds works, but then the CLI process hangs for "only" 3 seconds. Reducing
		// the timeout to 1 second may cause authentication failure if the laptop or CI
		// server are slow for any reason. The only reliable way around it seems to be to
		// explicitly unref the sockets, so the event loop stops waiting for it. See:
		// https://github.com/nodejs/node/issues/2642
		// https://github.com/nodejs/node-v0.x-archive/issues/9066
		//
		this.serverSockets.forEach((s) => s.unref());
		this.serverSockets.splice(0);
	}

	/**
	 * Await for the user to complete login through a web browser.
	 * Resolve to the authentication token string.
	 *
	 * @return Promise that resolves to the authentication token string
	 */
	public async awaitForToken(): Promise<string> {
		if (this.firstError) {
			throw this.firstError;
		}
		if (this.token) {
			return this.token;
		}
		return new Promise<string>((resolve, reject) => {
			this.on('error', reject);
			this.on('token', resolve);
		});
	}
}
