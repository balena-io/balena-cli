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

import { getBalenaSdk } from '../utils/lazy';

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
export const login = async () => {
	const utils = await import('./utils');

	const options = {
		port: 8989,
		path: '/auth',
	};

	// Needs to be 127.0.0.1 not localhost, because the ip only is whitelisted
	// from mixed content warnings (as the target of a form in the result page)
	const callbackUrl = `http://127.0.0.1:${options.port}${options.path}`;
	const loginUrl = await utils.getDashboardLoginURL(callbackUrl);
	// Leave a bit of time for the
	// server to get up and runing
	setTimeout(async () => {
		const open = await import('open');
		open(loginUrl, { wait: false });
	}, 1000);

	const server = await import('./server');
	const balena = getBalenaSdk();
	return server.awaitForToken(options).tap(balena.auth.loginWithToken);
};
