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

import * as Bluebird from 'bluebird';
import * as bodyParser from 'body-parser';
import * as express from 'express';
import type { Socket } from 'net';
import * as path from 'path';

import * as utils from './utils';
import { ExpectedError } from '../errors';

const serverSockets: Socket[] = [];

const createServer = ({ port }: { port: number }) => {
	const app = express();
	app.use(
		bodyParser.urlencoded({
			extended: true,
		}),
	);

	app.set('view engine', 'ejs');
	app.set('views', path.join(__dirname, 'pages'));

	const server = app.listen(port);
	server.on('connection', (socket) => serverSockets.push(socket));

	return { app, server };
};

/**
 * By design (more like a bug, but they won't admit it), a Node.js `http.server`
 * instance prevents the process from exiting for up to 2 minutes (by default) if a
 * client keeps a HTTP connection open, and regardless of whether `server.close()`
 * was called: the `server.close(callback)` callback takes just as long to be called.
 * Setting `server.timeout` to some value like 3 seconds works, but then the CLI
 * process hangs for "only" 3 seconds (not good enough). Reducing the timeout to 1
 * second may cause authentication failure if the laptop or CI server are slow for
 * any reason. The only reliable way around it seems to be to explicitly unref the
 * sockets, so the event loop stops waiting for it. See:
 * https://github.com/nodejs/node/issues/2642
 * https://github.com/nodejs/node-v0.x-archive/issues/9066
 */
export function shutdownServer() {
	serverSockets.forEach((s) => s.unref());
	serverSockets.splice(0);
}

/**
 * @summary Await for token
 * @function
 * @protected
 *
 * @param {Object} options - options
 * @param {String} options.path - callback path
 * @param {Number} options.port - http port
 *
 * @example
 * server.awaitForToken
 * 	path: '/auth'
 * 	port: 9001
 * .then (token) ->
 *   console.log(token)
 */
export const awaitForToken = (options: {
	path: string;
	port: number;
}): Bluebird<string> => {
	const { app, server } = createServer({ port: options.port });

	return new Bluebird<string>((resolve, reject) => {
		app.post(options.path, async (request, response) => {
			server.close(); // stop listening for new connections
			try {
				const token = request.body.token?.trim();
				if (!token) {
					throw new ExpectedError('No token');
				}
				const loggedIn = await utils.loginIfTokenValid(token);
				if (!loggedIn) {
					throw new ExpectedError('Invalid token');
				}
				response.status(200).render('success');
				resolve(token);
			} catch (error) {
				response.status(401).render('error');
				reject(new Error(error.message));
			}
		});

		app.use((_request, response) => {
			server.close(); // stop listening for new connections
			response.status(404).send('Not found');
			reject(new Error('Unknown path or verb'));
		});
	});
};
