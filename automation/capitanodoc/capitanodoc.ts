/**
 * @license
 * Copyright 2019 Balena Ltd.
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

import * as path from 'path';
import { MarkdownFileParser } from './utils';

/**
 * This is the skeleton of CLI documentation/reference web page at:
 * https://www.balena.io/docs/reference/cli/
 *
 * The `getCapitanoDoc` function in this module parses README.md and adds
 * some content to this object.
 *
 * IMPORTANT
 *
 * Only build files listed here will be documented by Capitano
 * Make sure to add your files in alphabetical order
 *
 * Resources with plural names needs to have 2 sections if they have commands like:
 * "fleet, fleets" or "device, devices" or "tag, tags"
 *
 */
const capitanoDoc = {
	title: 'balena CLI Documentation',
	introduction: '',
	categories: [
		{
			title: 'API Key',
			files: ['build/commands/api-keys/index.js'],
		},
		{
			title: 'API Keys',
			files: [
				'build/commands/api-key/generate.js',
				'build/commands/api-key/revoke.js',
			],
		},
		{
			title: 'App',
			files: ['build/commands/app/create.js'],
		},
		{
			title: 'Authentication',
			files: [
				'build/commands/login.js',
				'build/commands/logout.js',
				'build/commands/whoami.js',
			],
		},
		{
			title: 'Block',
			files: ['build/commands/app/create.js'],
		},
		{
			title: 'Config',
			files: [
				'build/commands/config/generate.js',
				'build/commands/config/inject.js',
				'build/commands/config/read.js',
				'build/commands/config/reconfigure.js',
				'build/commands/config/write.js',
			],
		},
		{
			title: 'Deploy',
			files: ['build/commands/build.js', 'build/commands/deploy.js'],
		},
		{
			title: 'Device',
			files: [
				'build/commands/device/deactivate.js',
				'build/commands/device/identify.js',
				'build/commands/device/index.js',
				'build/commands/device/init.js',
				'build/commands/device/local-mode.js',
				'build/commands/device/move.js',
				'build/commands/device/os-update.js',
				'build/commands/device/pin.js',
				'build/commands/device/public-url.js',
				'build/commands/device/purge.js',
				'build/commands/device/reboot.js',
				'build/commands/device/register.js',
				'build/commands/device/rename.js',
				'build/commands/device/restart.js',
				'build/commands/device/rm.js',
				'build/commands/device/shutdown.js',
				'build/commands/device/track-fleet.js',
				'build/commands/device/start-service.js',
				'build/commands/device/stop-service.js',
			],
		},
		{
			title: 'Devices',
			files: [
				'build/commands/devices/index.js',
				'build/commands/devices/supported.js',
			],
		},
		{
			title: 'Environment Variable',
			files: [
				'build/commands/env/add.js',
				'build/commands/env/rename.js',
				'build/commands/env/rm.js',
			],
		},
		{
			title: 'Environment Variables',
			files: ['build/commands/envs.js'],
		},
		{
			title: 'Fleet',
			files: [
				'build/commands/fleet/create.js',
				'build/commands/fleet/index.js',
				'build/commands/fleet/pin.js',
				'build/commands/fleet/purge.js',
				'build/commands/fleet/rename.js',
				'build/commands/fleet/restart.js',
				'build/commands/fleet/rm.js',
				'build/commands/fleet/track-latest.js',
			],
		},
		{
			title: 'Fleets',
			files: ['build/commands/fleets.js'],
		},
		{
			title: 'Help and Version',
			files: ['help', 'build/commands/version.js'],
		},
		{
			title: 'Local',
			files: [
				'build/commands/local/configure.js',
				'build/commands/local/flash.js',
			],
		},
		{
			title: 'Logs',
			files: ['build/commands/logs.js'],
		},
		{
			title: 'Network',
			files: [
				'build/commands/scan.js',
				'build/commands/ssh.js',
				'build/commands/tunnel.js',
			],
		},
		{
			title: 'Notes',
			files: ['build/commands/note.js'],
		},
		{
			title: 'Organizations',
			files: ['build/commands/orgs.js'],
		},
		{
			title: 'OS',
			files: [
				'build/commands/os/build-config.js',
				'build/commands/os/configure.js',
				'build/commands/os/download.js',
				'build/commands/os/initialize.js',
				'build/commands/os/versions.js',
			],
		},
		{
			title: 'Preload',
			files: ['build/commands/preload.js'],
		},
		{
			title: 'Push',
			files: ['build/commands/push.js'],
		},
		{
			title: 'Platform',
			files: ['build/commands/join.js', 'build/commands/leave.js'],
		},
		{
			title: 'Release',
			files: [
				'build/commands/release/finalize.js',
				'build/commands/release/index.js',
				'build/commands/release/invalidate.js',
				'build/commands/release/validate.js',
			],
		},
		{
			title: 'Releases',
			files: ['build/commands/releases.js'],
		},
		{
			title: 'Settings',
			files: ['build/commands/settings.js'],
		},
		{
			title: 'Support',
			files: ['build/commands/support.js'],
		},

		{
			title: 'SSH Key',
			files: [
				'build/commands/key/add.js',
				'build/commands/key/index.js',
				'build/commands/key/rm.js',
			],
		},
		{
			title: 'SSH Keys',
			files: ['build/commands/keys.js'],
		},
		{
			title: 'Tags',
			files: ['build/commands/tag/rm.js', 'build/commands/tag/set.js'],
		},
		{
			title: 'Tags',
			files: ['build/commands/tags.js'],
		},
		{
			title: 'Utilities',
			files: ['build/commands/util/available-drives.js'],
		},
	],
};

/**
 * Modify and return the `capitanoDoc` object above in order to render the
 * CLI documentation/reference web page at:
 * https://www.balena.io/docs/reference/cli/
 *
 * This function parses the README.md file to extract relevant sections
 * for the documentation web page.
 */
export async function getCapitanoDoc(): Promise<typeof capitanoDoc> {
	const readmePath = path.join(__dirname, '..', '..', 'README.md');
	const mdParser = new MarkdownFileParser(readmePath);
	const sections: string[] = await Promise.all([
		mdParser.getSectionOfTitle('About').then((sectionLines: string) => {
			// delete the title of the 'About' section for the web page
			const match = /^(#+)\s+.+?\n\s*([^]*)/.exec(sectionLines);
			if (!match || match.length < 3) {
				throw new Error(`Error parsing section title`);
			}
			// match[1] has the title, match[2] has the rest
			return match && match[2];
		}),
		mdParser.getSectionOfTitle('Installation'),
		mdParser.getSectionOfTitle('Choosing a shell (command prompt/terminal)'),
		mdParser.getSectionOfTitle('Logging in'),
		mdParser.getSectionOfTitle('Proxy support'),
		mdParser.getSectionOfTitle('Support, FAQ and troubleshooting'),
		mdParser.getSectionOfTitle('Deprecation policy'),
	]);
	capitanoDoc.introduction = sections.join('\n');
	return capitanoDoc;
}
