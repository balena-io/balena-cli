/*
Copyright 2016 Resin.io

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

import express = require('express');
import path = require('path');
import bodyParser = require('body-parser');
import Promise = require('bluebird');
import { resin } from '../sdk';
import utils = require('./utils');

function createServer(param?: { port?: number; isDev?: boolean }) {
	if (param == null) {
		param = {};
	}
	const { port, isDev } = param;
	const app = express();
	app.use(
		bodyParser.urlencoded({
			extended: true,
		}),
	);

	app.set('view engine', 'ejs');
	app.set('views', path.join(__dirname, 'pages'));

	if (isDev) {
		app.use(express.static(path.join(__dirname, 'pages', 'static')));
	}

	const server = app.listen(port);

	return { app, server };
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
export function awaitForToken(options: { path: string; port: number }) {
	const { app, server } = createServer({ port: options.port });

	return new Promise<string>(function(resolve, reject) {
		const closeServer = (
			errorMessage: string | undefined,
			successPayload?: string,
		) =>
			server.close(function() {
				if (errorMessage) {
					reject(new Error(errorMessage));
					return;
				}

				resolve(successPayload);
			});

		const renderAndDone = ({
			request,
			response,
			viewName,
			errorMessage,
			statusCode,
			token,
		}: {
			request: express.Request;
			response: express.Response;
			viewName: string;
			errorMessage?: string;
			statusCode?: number;
			token?: string;
		}) =>
			getContext(viewName).then(function(context) {
				response.status(statusCode || 200).render(viewName, context);
				request.connection.destroy();
				closeServer(errorMessage, token);
			});

		app.post(options.path, function(request, response) {
			const token =
				request.body.token != null ? request.body.token.trim() : undefined;

			Promise.try(function() {
				if (!token) {
					throw new Error('No token');
				}

				return utils.isTokenValid(token);
			})
				.tap(function(isValid) {
					if (!isValid) {
						throw new Error('Invalid token');
					}
				})
				.then(() =>
					renderAndDone({ request, response, viewName: 'success', token }),
				)
				.catch(error =>
					renderAndDone({
						request,
						response,
						viewName: 'error',
						statusCode: 401,
						errorMessage: error.message,
					}),
				);
		});

		app.use(function(_request, response) {
			response.status(404).send('Not found');
			closeServer('Unknown path or verb');
		});
	});
}

export function getContext(viewName: string) {
	if (viewName === 'success') {
		return Promise.props({
			dashboardUrl: resin.settings.get('dashboardUrl'),
		});
	}

	return Promise.resolve({});
}
