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

import { getBalenaSdk } from '../utils/lazy.js';
import { LoginServer } from './server.js';

/**
 * @module auth
 */

/**
 * @summary Login to the balena CLI using the web dashboard
 * @function
 * @public
 *
 * @description
 * This function opens the user's default browser and points it
 * to the balena dashboard where the session token exchange will
 * take place.
 *
 * Once the the token is retrieved, it's automatically persisted.
 *
 * @fulfil {String} - session token
 * @returns {Promise}
 *
 * @example
 * auth.login().then (sessionToken) ->
 *   console.log('I\'m logged in!')
 *   console.log("My session token is: #{sessionToken}")
 */
export async function login({ host = '127.0.0.1', port = 0 }) {
	const utils = await import('./utils.js');

	const loginServer = new LoginServer();
	const {
		host: actualHost,
		port: actualPort,
		urlPath,
	} = await loginServer.start({ host, port });

	const callbackUrl = `http://${actualHost}:${actualPort}${urlPath}`;
	const loginUrl = await utils.getDashboardLoginURL(callbackUrl);

	console.info(`Opening web browser for URL:\n${loginUrl}`);
	const { default: open } = await import('open');
	await open(loginUrl, { wait: false });

	const balena = getBalenaSdk();
	const token = await loginServer.awaitForToken();
	await balena.auth.loginWithToken(token);
	loginServer.shutdown();
	return token;
}
