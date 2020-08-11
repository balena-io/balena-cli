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

import * as _ from 'lodash';
import * as url from 'url';
import { getBalenaSdk } from '../utils/lazy';

/**
 * @summary Get dashboard CLI login URL
 * @function
 * @protected
 *
 * @param {String} callbackUrl - callback url
 * @fulfil {String} - dashboard login url
 * @returns {Promise}
 *
 * @example
 * utils.getDashboardLoginURL('http://127.0.0.1:3000').then (url) ->
 * 	console.log(url)
 */
export const getDashboardLoginURL = (callbackUrl: string) => {
	// Encode percentages signs from the escaped url
	// characters to avoid angular getting confused.
	callbackUrl = encodeURIComponent(callbackUrl).replace(/%/g, '%25');

	return getBalenaSdk()
		.settings.get('dashboardUrl')
		.then((dashboardUrl) =>
			url.resolve(dashboardUrl, `/login/cli/${callbackUrl}`),
		);
};

/**
 * @summary Log in using a token, but only if the token is valid
 * @function
 * @protected
 *
 * @description
 * This function checks that the token is not only well-structured
 * but that it also authenticates with the server successfully.
 *
 * If authenticated, the token is persisted, if not then the previous
 * login state is restored.
 *
 * @param {String} token - session token or api key
 * @fulfil {Boolean} - whether the login was successful or not
 * @returns {Promise}
 *
 * utils.loginIfTokenValid('...').then (loggedIn) ->
 *   if loggedIn
 *     console.log('Token is valid!')
 */
export const loginIfTokenValid = async (token: string): Promise<boolean> => {
	if (_.isEmpty(token?.trim())) {
		return false;
	}
	const balena = getBalenaSdk();

	let currentToken;
	try {
		currentToken = await balena.auth.getToken();
	} catch {
		// ignore
	}

	await balena.auth.loginWithToken(token);
	const isLoggedIn = await balena.auth.isLoggedIn();
	if (!isLoggedIn) {
		if (currentToken != null) {
			await balena.auth.loginWithToken(currentToken);
		} else {
			await balena.auth.logout();
		}
	}
	return isLoggedIn;
};
