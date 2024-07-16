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

/**
 * This module sets up the `fast-boot2` module, including testing whether
 * we have permissions over the cache file before even attempting to load
 * fast boot.
 * DON'T IMPORT BALENA-CLI MODULES HERE, as this module is loaded directly
 * from `bin/run.js`, before the CLI's entrypoint in `lib/app.ts`.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const stat = process.pkg ? fs.statSync : fs.promises.stat;

let fastBootStarted = false;

export async function start() {
	if (fastBootStarted) {
		return;
	}
	try {
		await $start();
		fastBootStarted = true;
	} catch (e) {
		if (process.env.DEBUG) {
			console.error(`\
[debug] Unable to start 'fast-boot2':
[debug] ${(e.message || '').split('\n').join('\n[debug] ')}
[debug] The CLI should still work, but it will run a bit slower.`);
		}
	}
}

export function stop() {
	if (fastBootStarted) {
		require('fast-boot2').stop();
	}
	fastBootStarted = false;
}

async function $start() {
	const dotBalena = process.platform === 'win32' ? '_balena' : '.balena';
	// TODO: take into account `~/.balenarc.yml` or `./balenarc.yml`,
	// without hurting performance at this early loading stage.
	const dataDir = path.normalize(
		process.env.BALENARC_DATA_DIRECTORY || path.join(os.homedir(), dotBalena),
	);
	// Consider that the CLI may be installed to a folder owned by root
	// such as `/usr[/local]/lib/balena-cli`, while being executed by
	// a regular user account.
	const cacheFile = path.join(dataDir, 'cli-module-cache.json');
	const root = path.join(import.meta.dirname, '..');
	const [, pJson, pStat, nStat] = await Promise.all([
		ensureCanWrite(dataDir, cacheFile),
		import('../package.json'),
		stat(path.join(root, 'package.json'), { bigint: true }),
		stat(path.join(root, 'npm-shrinkwrap.json'), { bigint: true }),
	]);
	// Include timestamps to account for dev-time changes to node_modules
	const cacheKiller = `${pJson.default.version}-${pStat.mtimeMs}-${nStat.mtimeMs}`;
	require('fast-boot2').start({
		cacheFile,
		cacheKiller,
		cacheScope: root,
	});
}

/**
 * Check that `file` has write permission. If so, return straight away.
 * Throw an error if:
 * - `file` exists but does have write permissions.
 * - `file` does not exist and `dir` exists, but `dir` does not have
 *    write permissions.
 * - `file` does not exist and `dir` does not exist, and an attempt
 *    to create `dir` failed.
 */
async function ensureCanWrite(dir: string, file: string) {
	const { access, mkdir } = fs.promises;
	try {
		try {
			await access(file, fs.constants.W_OK);
			return;
		} catch (e) {
			// OK if file does not exist
			if (e.code !== 'ENOENT') {
				throw e;
			}
		}
		// file does not exist; ensure that the directory is writable
		await mkdir(dir, { recursive: true, mode: 0o755 });
		await access(dir, fs.constants.W_OK);
	} catch (e) {
		throw new Error(`Unable to write file "${file}":\n${e.message}`);
	}
}
