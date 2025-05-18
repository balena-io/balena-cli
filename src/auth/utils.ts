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

import { getBalenaSdk } from '../utils/lazy.js';

/**
 * Get dashboard CLI login URL
 *
 * @param callbackUrl - Callback url, e.g. 'http://127.0.0.1:3000'
 * @returns Dashboard login URL, e.g.:
 * 'https://dashboard.balena-cloud.com/login/cli/http%253A%252F%252F127.0.0.1%253A59581%252Fauth'
 */
export async function getDashboardLoginURL(
	callbackUrl: string,
): Promise<string> {
	// Encode percentages signs from the escaped url
	// characters to avoid angular getting confused.
	callbackUrl = encodeURIComponent(callbackUrl).replace(/%/g, '%25');

	const [{ URL }, dashboardUrl] = await Promise.all([
		import('url'),
		getBalenaSdk().settings.get('dashboardUrl'),
	]);
	return new URL(`/login/cli/${callbackUrl}`, dashboardUrl).href;
}

/**
 * Log in using a token, but only if the token is valid.
 *
 * This function checks that the token is not only well-structured
 * but that it also authenticates with the server successfully.
 *
 * If authenticated, the token is persisted, if not then the previous
 * login state is restored.
 *
 * @param token - session token or api key
 * @returns whether the login was successful or not
 */
export async function loginIfTokenValid(token?: string): Promise<boolean> {
	token = (token || '').trim();
	if (!token) {
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
}
