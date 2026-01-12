/**
 * @license
 * Copyright 2020 Balena Ltd.
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

import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const patchesDir = 'patches';

/**
 * Run the patch-package tool in a child process and wait for it to finish
 * @param {string} patchDir
 */
async function patchPackage(patchDir) {
	// Equivalent to: `npx patch-package --patch-dir $patchDir`
	const result = await execFileAsync('node', [
		path.join('node_modules', 'patch-package', 'index.js'),
		'--patch-dir',
		patchDir,
	]);
	for (const out of [result.stdout, result.stderr]) {
		if (out) {
			if (out.includes('ERROR') || out.includes('Failed to apply')) {
				throw new Error(out);
			} else {
				console.error(out);
			}
		}
	}
}

/**
 * Apply patch files found in the following directories, if they exist:
 *   * patches/before-all - applied before all other patches
 *   * patches/all        - patch files common to all platforms
 *   * patches/unix       - patch files for Linux and macOS
 *   * patches/darwin     - patch files for macOS only
 *   * patches/linux      - patch files for Linux only
 *   * patches/win32      - patch files for Windows only
 */
async function applyPatches() {
	const isUnix = ['linux', 'darwin'].includes(process.platform);
	const patchDirs = [
		path.join(patchesDir, 'before-all'),
		path.join(patchesDir, 'all'),
		...(isUnix ? [path.join(patchesDir, 'unix')] : []),
		path.join(patchesDir, process.platform),
	];
	for (const patchDir of patchDirs) {
		if (fs.existsSync(patchDir)) {
			console.error(`Applying patches from "${patchDir}"...`);
			await patchPackage(patchDir);
		}
	}
}

async function run() {
	try {
		await applyPatches();
	} catch (err) {
		console.error(`Failed to apply some patches:\n${err}`);
		process.exitCode = 1;
	}
}

run();
