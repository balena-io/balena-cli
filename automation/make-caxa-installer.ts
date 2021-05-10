/**
 * @license
 * Copyright 2021 Balena Ltd.
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

import caxa from 'caxa';
import * as os from 'os';
import * as path from 'path';
import { promises as fs } from 'fs';
import { remove } from 'fs-extra';

import { ROOT } from './utils';

// balena-cli folders and files to include in the caxa installer
const itemsToCopy = [
	'bin',
	'build',
	'node_modules',
	'npm-shrinkwrap.json',
	'oclif.manifest.json',
	'package.json',
];

export async function makeCaxaInstaller() {
	const absItemsToCopy = itemsToCopy.map((i) => path.join(ROOT, i));
	// select directory entries only, and append trailing '/' or '\\'
	const dirsToCopy = (
		await Promise.all(
			absItemsToCopy.map(async (v) => {
				const stat = await fs.stat(v);
				if (stat.isDirectory()) {
					return v.endsWith(path.sep) ? v : v + path.sep;
				}
				return '';
			}),
		)
	).filter((dir) => dir);
	const { caxaInstallers } = await import('./build-bin');
	const balenaInstallDir = '/usr/local/lib/balena-cli';
	const caxaSourceDir = ROOT;
	const caxaExecutable = caxaInstallers[process.platform];
	await caxa({
		command: ['{{caxa}}/node_modules/.bin/node', '{{caxa}}/build/installer.js'],
		input: caxaSourceDir,
		output: caxaExecutable,
		identifier: balenaInstallDir,
		filter: (src: string, _dest: string) =>
			dirsToCopy.some((v) => src.startsWith(v)) ||
			absItemsToCopy.some((v) => src === v) ||
			src === ROOT,
		// npm v6 compatibility
		dedupe: false,
		prepareCommand: 'npm prune --production',
		removeBuildDirectory: true,
	});
	const caxaTmp = path.join(os.tmpdir(), 'caxa');
	console.error(`Cleaning up caxa temp dir "${caxaTmp}"`);
	await remove(caxaTmp);
	console.error(`Caxa installer created at "${caxaExecutable}"`);
}

async function run() {
	if (process.platform === 'win32') {
		console.error(`[info] Caxa installer will not be produced on Windows`);
		return;
	}
	await makeCaxaInstaller();
}

if (require.main === module) {
	run();
}
