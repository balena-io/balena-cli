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
 */
const capitanoDoc = {
	title: 'balenaCLI Documentation',
	introduction: '',
	categories: [
		{
			title: 'API keys',
			files: ['build/actions-oclif/api-key/generate.js'],
		},
		{
			title: 'Application',
			files: [
				'build/actions-oclif/apps.js',
				'build/actions-oclif/app/index.js',
				'build/actions-oclif/app/create.js',
				'build/actions-oclif/app/rm.js',
				'build/actions-oclif/app/rename.js',
				'build/actions-oclif/app/restart.js',
			],
		},
		{
			title: 'Authentication',
			files: [
				'build/actions-oclif/login.js',
				'build/actions-oclif/logout.js',
				'build/actions-oclif/whoami.js',
			],
		},
		{
			title: 'Device',
			files: [
				'build/actions-oclif/device/identify.js',
				'build/actions-oclif/device/init.js',
				'build/actions-oclif/device/index.js',
				'build/actions-oclif/device/move.js',
				'build/actions-oclif/device/reboot.js',
				'build/actions-oclif/device/register.js',
				'build/actions-oclif/device/rename.js',
				'build/actions-oclif/device/rm.js',
				'build/actions-oclif/device/restart.js',
				'build/actions-oclif/device/shutdown.js',
				'build/actions-oclif/devices/index.js',
				'build/actions-oclif/devices/supported.js',
				'build/actions-oclif/device/os-update.js',
				'build/actions-oclif/device/public-url.js',
			],
		},
		{
			title: 'Environment Variables',
			files: [
				'build/actions-oclif/envs.js',
				'build/actions-oclif/env/add.js',
				'build/actions-oclif/env/rename.js',
				'build/actions-oclif/env/rm.js',
			],
		},
		{
			title: 'Tags',
			files: [
				'build/actions-oclif/tags.js',
				'build/actions-oclif/tag/rm.js',
				'build/actions-oclif/tag/set.js',
			],
		},
		{
			title: 'Help and Version',
			files: ['help', 'build/actions-oclif/version.js'],
		},
		{
			title: 'Keys',
			files: [
				'build/actions-oclif/keys.js',
				'build/actions-oclif/key/index.js',
				'build/actions-oclif/key/add.js',
				'build/actions-oclif/key/rm.js',
			],
		},
		{
			title: 'Logs',
			files: ['build/actions-oclif/logs.js'],
		},
		{
			title: 'Network',
			files: [
				'build/actions-oclif/scan.js',
				'build/actions-oclif/ssh.js',
				'build/actions-oclif/tunnel.js',
			],
		},
		{
			title: 'Notes',
			files: ['build/actions-oclif/note.js'],
		},
		{
			title: 'OS',
			files: [
				'build/actions-oclif/os/build-config.js',
				'build/actions-oclif/os/configure.js',
				'build/actions-oclif/os/versions.js',
				'build/actions-oclif/os/download.js',
				'build/actions-oclif/os/initialize.js',
			],
		},
		{
			title: 'Config',
			files: [
				'build/actions-oclif/config/generate.js',
				'build/actions-oclif/config/inject.js',
				'build/actions-oclif/config/read.js',
				'build/actions-oclif/config/reconfigure.js',
				'build/actions-oclif/config/write.js',
			],
		},
		{
			title: 'Preload',
			files: ['build/actions-oclif/preload.js'],
		},
		{
			title: 'Push',
			files: ['build/actions-oclif/push.js'],
		},
		{
			title: 'Settings',
			files: ['build/actions-oclif/settings.js'],
		},
		{
			title: 'Local',
			files: [
				'build/actions-oclif/local/configure.js',
				'build/actions-oclif/local/flash.js',
			],
		},
		{
			title: 'Deploy',
			files: ['build/actions-oclif/build.js', 'build/actions-oclif/deploy.js'],
		},
		{
			title: 'Platform',
			files: ['build/actions-oclif/join.js', 'build/actions-oclif/leave.js'],
		},
		{
			title: 'Utilities',
			files: ['build/actions-oclif/util/available-drives.js'],
		},
		{
			title: 'Support',
			files: ['build/actions-oclif/support.js'],
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
