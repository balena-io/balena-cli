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

import * as packageJSON from '../package.json';
import { getBalenaSdk, stripIndent } from './utils/lazy';

interface CachedUsername {
	token: string;
	username: string;
}

/**
 * Track balena CLI usage events (product improvement analytics).
 *
 * @param commandSignature A string like, for example:
 *      "push <fleetOrDevice>"
 * That's literally so: "fleetOrDevice" is NOT replaced with the actual
 * fleet ID or device ID. The purpose is to find out the most / least
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

		const username = await (async () => {
			const getStorage = await import('balena-settings-storage');
			const dataDirectory = settings.get<string>('dataDirectory');
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
			const balenaUrl = settings.get<string>('balenaUrl');
			await sendEvent(balenaUrl, `[CLI] ${commandSignature}`, username);
		}
	} catch {
		// ignore
	}
}

/**
 * Make the event tracking HTTPS request to balenaCloud's '/mixpanel' endpoint.
 */
async function sendEvent(balenaUrl: string, event: string, username?: string) {
	const { default: got } = await import('got');
	const trackData = {
		event,
		properties: {
			arch: process.arch,
			balenaUrl, // e.g. 'balena-cloud.com' or 'balena-staging.com'
			distinct_id: username,
			mp_lib: 'node',
			node: process.version,
			platform: process.platform,
			token: 'balena-main',
			version: packageJSON.version,
		},
	};
	const url = `https://api.${balenaUrl}/mixpanel/track`;
	const searchParams = {
		ip: 0,
		verbose: 0,
		data: Buffer.from(JSON.stringify(trackData)).toString('base64'),
	};
	try {
		await got(url, { searchParams, retry: 0, timeout: 4000 });
	} catch (e) {
		if (process.env.DEBUG) {
			console.error(`[debug] Event tracking error: ${e.message || e}`);
		}

		if (e instanceof got.TimeoutError) {
			console.error(stripIndent`
				Timeout submitting analytics event to balenaCloud/openBalena.
				If you are using the balena CLI in an air-gapped environment with a filtered
				internet connection, set the BALENARC_OFFLINE_MODE=1 environment variable
				when using CLI commands that do not strictly require access to balenaCloud.
			`);
		}
		// Note: You can simulate a timeout using non-routable address 10.0.0.0
	}
}
