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

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as whichMod from 'which';

export const ROOT = path.join(__dirname, '..');

export function loadPackageJson() {
	const packageJsonPath = path.join(ROOT, 'package.json');

	const packageJson = fs.readFileSync(packageJsonPath, 'utf8');
	return JSON.parse(packageJson);
}

/**
 * Error handling wrapper around the npm `which` package:
 * "Like the unix which utility. Finds the first instance of a specified
 * executable in the PATH environment variable. Does not cache the results,
 * so hash -r is not needed when the PATH changes."
 *
 * @param program Basename of a program, for example 'ssh'
 * @returns The program's full path, e.g. 'C:\WINDOWS\System32\OpenSSH\ssh.EXE'
 */
export async function which(program: string): Promise<string> {
	let programPath: string;
	try {
		programPath = await whichMod(program);
	} catch (err) {
		if (err.code === 'ENOENT') {
			throw new Error(`'${program}' program not found. Is it installed?`);
		}
		throw err;
	}
	return programPath;
}

/**
 * Call which(programName) and spawn() with the given arguments. Throw an error
 * if the process exit code is not zero.
 */
export async function whichSpawn(
	programName: string,
	args: string[] = [],
): Promise<void> {
	const program = await which(programName);
	let error: Error | undefined;
	let exitCode: number | undefined;
	try {
		exitCode = await new Promise<number>((resolve, reject) => {
			try {
				spawn(program, args, { stdio: 'inherit' })
					.on('error', reject)
					.on('close', resolve);
			} catch (err) {
				reject(err as Error);
			}
		});
	} catch (err) {
		error = err;
	}
	if (error || exitCode) {
		const msg = [
			`${programName} failed with exit code ${exitCode}:`,
			`"${program}" [${args}]`,
		];
		if (error) {
			msg.push(`${error}`);
		}
		throw new Error(msg.join('\n'));
	}
}
