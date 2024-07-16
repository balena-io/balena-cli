/*
Copyright 2016-2022 Balena

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

import isRoot from 'is-root';
import UpdateNotifier from 'update-notifier';
import packageJSON from '../../package.json' with { type: 'json' };
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

// Check for an update at most once a day. 1 day granularity should be
// enough, rather than every run. Note because we show the information
// from the *last* time we ran, if the cli has not been run for a while
// the update info can be out of date.
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
	const message = up && getNotifierMessage(up);
	if (message) {
		notifier.notify({ defer: false, message });
	}
}

export function getNotifierMessage(updateInfo: UpdateNotifier.UpdateInfo) {
	const semver = require('semver') as typeof import('semver');
	const message: string[] = [];
	const [current, latest] = [updateInfo.current, updateInfo.latest];

	if (semver.lt(current, latest)) {
		message.push(
			`Update available ${current} → ${latest}`,
			'https://github.com/balena-io/balena-cli/blob/master/INSTALL.md',
		);
		const currentMajor = semver.major(current);
		const latestMajor = semver.major(latest);
		if (currentMajor !== latestMajor) {
			message.push(
				'',
				`Check the v${latestMajor} release notes at:`,
				getReleaseNotesUrl(latestMajor),
			);
		}
	}
	return message.join('\n');
}

function getReleaseNotesUrl(majorVersion: number) {
	return `https://github.com/balena-io/balena-cli/wiki/CLI-v${majorVersion}-Release-Notes`;
}
