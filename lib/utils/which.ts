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

import { promises as fs, constants } from 'fs';
import * as path from 'path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

export const { F_OK, R_OK, W_OK, X_OK } = constants;

export async function exists(filename: string, mode = F_OK) {
	try {
		await fs.access(filename, mode);
		return true;
	} catch {
		return false;
	}
}

/**
 * Replace sequences of untowardly characters like /[<>:"/\\|?*\u0000-\u001F]/g
 * and '.' or '..' with an underscore, plus other rules enforced by the filenamify
 * package. See https://github.com/sindresorhus/filenamify/
 */
export function sanitizePath(filepath: string) {
	const filenamify = require('filenamify') as typeof import('filenamify');
	// normalize also converts forward slash to backslash on Windows
	return path
		.normalize(filepath)
		.split(path.sep)
		.map((f) => filenamify(f, { replacement: '_' }))
		.join(path.sep);
}

/**
 * Given a program name like 'mount', search for it in a pre-defined set of
 * folders ('/usr/bin', '/bin', '/usr/sbin', '/sbin') and return the full path if found.
 *
 * For executables, in some scenarios, this can be more secure than allowing
 * any folder in the PATH. Only relevant on Linux or macOS.
 */
export async function whichBin(programName: string): Promise<string> {
	for (const dir of ['/usr/bin', '/bin', '/usr/sbin', '/sbin']) {
		const candidate = path.join(dir, programName);
		if (await exists(candidate, X_OK)) {
			return candidate;
		}
	}
	return '';
}

/**
 * Error handling wrapper around the npm `which` package:
 * "Like the unix which utility. Finds the first instance of a specified
 * executable in the PATH environment variable. Does not cache the results,
 * so hash -r is not needed when the PATH changes."
 *
 * @param program Basename of a program, for example 'ssh'
 * @param rejectOnMissing If the program cannot be found, reject the promise
 * with an ExpectedError instead of fulfilling it with an empty string.
 * @returns The program's full path, e.g. 'C:\WINDOWS\System32\OpenSSH\ssh.EXE'
 */
export async function which(
	program: string,
	rejectOnMissing = true,
): Promise<string> {
	const { default: whichMod } = await import('which');
	let programPath: string;
	try {
		programPath = await whichMod(program);
	} catch (err) {
		if (err.code === 'ENOENT') {
			if (rejectOnMissing) {
				const { ExpectedError } = await import('../errors.js');
				throw new ExpectedError(
					`'${program}' program not found. Is it installed?`,
				);
			} else {
				return '';
			}
		}
		throw err;
	}
	return programPath;
}
