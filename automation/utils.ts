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
import { diffTrimmedLines } from 'diff';

export const ROOT = path.join(import.meta.dirname, '..');

/** Tap and buffer this process' stdout and stderr */
export class StdOutTap {
	public stdoutBuf: string[] = [];
	public stderrBuf: string[] = [];
	public allBuf: string[] = []; // both stdout and stderr

	protected origStdoutWrite: typeof process.stdout.write;
	protected origStderrWrite: typeof process.stdout.write;

	constructor(protected printDots = false) {}

	tap() {
		this.origStdoutWrite = process.stdout.write;
		this.origStderrWrite = process.stderr.write;

		process.stdout.write = (chunk: string, ...args: any[]): boolean => {
			this.stdoutBuf.push(chunk);
			this.allBuf.push(chunk);
			const str = this.printDots ? '.' : chunk;
			return this.origStdoutWrite.call(process.stdout, str, ...args);
		};

		process.stderr.write = (chunk: string, ...args: any[]): boolean => {
			this.stderrBuf.push(chunk);
			this.allBuf.push(chunk);
			const str = this.printDots ? '.' : chunk;
			return this.origStderrWrite.call(process.stderr, str, ...args);
		};
	}

	untap() {
		process.stdout.write = this.origStdoutWrite;
		process.stderr.write = this.origStderrWrite;
		if (this.printDots) {
			console.error('');
		}
	}
}

/**
 * Diff strings by line, using the 'diff' npm package:
 * https://www.npmjs.com/package/diff
 */
export function diffLines(str1: string, str2: string): string {
	const diffObjs = diffTrimmedLines(str1, str2);
	const prefix = (chunk: string, char: string) =>
		chunk
			.split('\n')
			.map((line: string) => `${char} ${line}`)
			.join('\n');
	const diffStr = diffObjs
		.map((part: any) => {
			return part.added
				? prefix(part.value, '+')
				: part.removed
					? prefix(part.value, '-')
					: prefix(part.value, ' ');
		})
		.join('\n');
	return diffStr;
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
	const { default: whichMod } = await import('which');
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
				reject(err);
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
