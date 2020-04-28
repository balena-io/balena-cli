/*
Copyright 2016-2019 Balena

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

import isRoot = require('is-root');
import * as UpdateNotifier from 'update-notifier';

import packageJSON = require('../../package.json');

// Check for an update once a day. 1 day granularity should be
// enough, rather than every run.
const balenaUpdateInterval = 1000 * 60 * 60 * 24 * 1;

let notifier: UpdateNotifier.UpdateNotifier;

export function notify() {
	if (!notifier) {
		// `update-notifier` creates files to make the next
		// running time ask for updated, however this can lead
		// to ugly EPERM issues if those files are created as root.
		if (isRoot()) {
			return;
		} else {
			notifier = UpdateNotifier({
				pkg: packageJSON,
				updateCheckInterval: balenaUpdateInterval,
			});
		}
	}
	const up = notifier.update;
	if (
		up &&
		(require('semver') as typeof import('semver')).lt(up.current, up.latest)
	) {
		notifier.notify({
			defer: false,
			message: `Update available ${up.current} → ${up.latest}\n
https://github.com/balena-io/balena-cli/blob/master/INSTALL.md`,
		});
	}
}
