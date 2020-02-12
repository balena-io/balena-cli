/*
Copyright 2016 Balena

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

import * as balenaSdk from 'balena-sdk';
import * as Promise from 'bluebird';
import * as bodyParser from 'body-parser';
import * as express from 'express';
import * as path from 'path';
import * as utils from './utils';

const balena = balenaSdk.fromSharedOptions();

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

	return { app, server };
};

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
}): Promise<string> => {
	const { app, server } = createServer({ port: options.port });

	return new Promise<string>((resolve, reject) => {
		const closeServer = (
			errorMessage: string | undefined,
			successPayload?: string,
		) => {
			server.close(() => {
				if (errorMessage) {
					reject(new Error(errorMessage));
					return;
				}

				resolve(successPayload);
			});
		};

		const renderAndDone = async ({
			request,
			response,
			viewName,
			errorMessage,
			statusCode = 200,
			token,
		}: {
			request: express.Request;
			response: express.Response;
			viewName: 'success' | 'error';
			errorMessage?: string;
			statusCode?: number;
			token?: string;
		}) => {
			const context = await getContext(viewName);
			response.status(statusCode).render(viewName, context);
			request.connection.destroy();
			closeServer(errorMessage, token);
		};

		app.post(options.path, async (request, response) => {
			try {
				const token = request.body.token?.trim();

				if (!token) {
					throw new Error('No token');
				}
				const loggedIn = await utils.loginIfTokenValid(token);
				if (!loggedIn) {
					throw new Error('Invalid token');
				}
				await renderAndDone({ request, response, viewName: 'success', token });
			} catch (error) {
				await renderAndDone({
					request,
					response,
					viewName: 'error',
					statusCode: 401,
					errorMessage: error.message,
				});
			}
		});

		app.use((_request, response) => {
			response.status(404).send('Not found');
			closeServer('Unknown path or verb');
		});
	});
};

export const getContext = (viewName: 'success' | 'error') => {
	if (viewName === 'success') {
		return Promise.props({
			dashboardUrl: balena.settings.get('dashboardUrl'),
		});
	}

	return Promise.resolve({});
};
