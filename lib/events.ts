/**
 * @license
 * Copyright 2019-2020 Balena Ltd.
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
import * as _ from 'lodash';
import * as Mixpanel from 'mixpanel';

import * as packageJSON from '../package.json';
import { getBalenaSdk } from './utils/lazy';

const getMixpanel = _.once((balenaUrl: string) => {
	return Mixpanel.init('balena-main', {
		host: `api.${balenaUrl}`,
		path: '/mixpanel',
		protocol: 'https',
	});
});

interface CachedUsername {
	token: string;
	username: string;
}

/**
 * Mixpanel.com analytics tracking (information on balena CLI usage).
 *
 * @param commandSignature A string like, for example:
 *      "push <applicationOrDevice>"
 * That's literally so: "applicationOrDevice" is NOT replaced with the actual
 * application ID or device ID. The purpose is to find out the most / least
 * used command verbs, so we can focus our development effort where it is most
 * beneficial to end users.
 *
 * The username and command signature are also added as extra context
 * information in Sentry.io error reporting, for CLI debugging purposes
 * (mainly unexpected/unhandled exceptions -- see also `lib/errors.ts`).
 *
 * For more details on the data collected by balena generally, check this page:
 * https://www.balena.io/docs/learn/more/collected-data/
 */
export async function trackCommand(commandSignature: string) {
	try {
		let Sentry: typeof import('@sentry/node');
		if (!process.env.BALENARC_NO_SENTRY) {
			Sentry = await import('@sentry/node');
			Sentry.configureScope((scope) => {
				scope.setExtra('command', commandSignature);
			});
		}
		const settings = await import('balena-settings-client');
		const balenaUrl = settings.get('balenaUrl') as string;

		const username = await (async () => {
			const getStorage = await import('balena-settings-storage');
			const dataDirectory = settings.get('dataDirectory') as string;
			const storage = getStorage({ dataDirectory });
			let token;
			try {
				token = await storage.get('token');
			} catch {
				// If we can't get a token then we can't get a username
				return;
			}
			try {
				const result = (await storage.get('cachedUsername')) as CachedUsername;
				if (result.token === token) {
					return result.username;
				}
			} catch {
				// ignore
			}
			try {
				const balena = getBalenaSdk();
				const $username = await balena.auth.whoami();
				await storage.set('cachedUsername', {
					token,
					username: $username,
				} as CachedUsername);
				return $username;
			} catch {
				return;
			}
		})();

		const mixpanel = getMixpanel(balenaUrl);

		if (!process.env.BALENARC_NO_SENTRY) {
			Sentry!.configureScope((scope) => {
				scope.setUser({
					id: username,
					username,
				});
			});
		}
		// Don't actually call mixpanel.track() while running test cases, or if suppressed
		if (
			!process.env.BALENA_CLI_TEST_TYPE &&
			!process.env.BALENARC_NO_ANALYTICS
		) {
			await mixpanel.track(`[CLI] ${commandSignature}`, {
				distinct_id: username,
				version: packageJSON.version,
				node: process.version,
				arch: process.arch,
				balenaUrl, // e.g. 'balena-cloud.com' or 'balena-staging.com'
				platform: process.platform,
			});
		}
	} catch {
		// ignore
	}
}
