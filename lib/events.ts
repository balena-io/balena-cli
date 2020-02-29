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
import * as Sentry from '@sentry/node';
import * as Bluebird from 'bluebird';
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
 */
export function trackCommand(commandSignature: string) {
	const balena = getBalenaSdk();
	const balenaUrlPromise = balena.settings.get('balenaUrl');
	return Bluebird.props({
		balenaUrl: balenaUrlPromise,
		username: balena.auth.whoami().catchReturn(undefined),
		mixpanel: balenaUrlPromise.then(getMixpanel),
	})
		.then(({ username, balenaUrl, mixpanel }) => {
			Sentry.configureScope(scope => {
				scope.setExtra('command', commandSignature);
				scope.setUser({
					id: username,
					username,
				});
			});
			return mixpanel.track(`[CLI] ${commandSignature}`, {
				distinct_id: username,
				version: packageJSON.version,
				node: process.version,
				arch: process.arch,
				balenaUrl, // e.g. 'balena-cloud.com' or 'balena-staging.com'
				platform: process.platform,
			});
		})
		.timeout(100)
		.catchReturn(undefined);
}
