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
	title: 'Balena CLI Documentation',
	introduction: '',
	categories: [
		{
			title: 'API keys',
			files: ['build/actions/api-key.js'],
		},
		{
			title: 'Application',
			files: [
				'build/actions-oclif/apps.js',
				'build/actions-oclif/app/index.js',
				'build/actions-oclif/app/create.js',
				'build/actions-oclif/app/rm.js',
				'build/actions-oclif/app/restart.js',
			],
		},
		{
			title: 'Authentication',
			files: ['build/actions/auth.js'],
		},
		{
			title: 'Device',
			files: [
				'build/actions/device.js',
				'build/actions-oclif/devices/supported.js',
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
			files: ['build/actions/tags.js'],
		},
		{
			title: 'Help and Version',
			files: ['build/actions/help.js', 'build/actions-oclif/version.js'],
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
			files: ['build/actions/logs.js'],
		},
		{
			title: 'Network',
			files: [
				'build/actions-oclif/scan.js',
				'build/actions/ssh.js',
				'build/actions/tunnel.js',
			],
		},
		{
			title: 'Notes',
			files: ['build/actions-oclif/note.js'],
		},
		{
			title: 'OS',
			files: ['build/actions/os.js', 'build/actions-oclif/os/configure.js'],
		},
		{
			title: 'Config',
			files: ['build/actions/config.js'],
		},
		{
			title: 'Preload',
			files: ['build/actions/preload.js'],
		},
		{
			title: 'Push',
			files: ['build/actions/push.js'],
		},
		{
			title: 'Settings',
			files: ['build/actions-oclif/settings.js'],
		},
		{
			title: 'Local',
			files: ['build/actions/local/index.js'],
		},
		{
			title: 'Deploy',
			files: ['build/actions/build.js', 'build/actions/deploy.js'],
		},
		{
			title: 'Platform',
			files: ['build/actions-oclif/join.js', 'build/actions-oclif/leave.js'],
		},
		{
			title: 'Utilities',
			files: ['build/actions/util.js'],
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
		mdParser.getSectionOfTitle('Getting Started'),
		mdParser.getSectionOfTitle('Support, FAQ and troubleshooting'),
	]);
	capitanoDoc.introduction = sections.join('\n');
	return capitanoDoc;
}
