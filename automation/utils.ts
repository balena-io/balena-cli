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
import * as _ from 'lodash';
import * as path from 'path';
import * as shellEscape from 'shell-escape';

export const MSYS2_BASH =
	process.env.MSYSSHELLPATH || 'C:\\msys64\\usr\\bin\\bash.exe';
export const ROOT = path.join(__dirname, '..');

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
	const { diffTrimmedLines } = require('diff');
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

export function loadPackageJson() {
	return require(path.join(ROOT, 'package.json'));
}

/**
 * Convert e.g. 'C:\myfolder' -> '/C/myfolder' so that the path can be given
 * as argument to "unix tools" like 'tar' under MSYS or MSYS2 on Windows.
 */
export function fixPathForMsys(p: string): string {
	return p.replace(/\\/g, '/').replace(/^([a-zA-Z]):/, '/$1');
}

/**
 * Run the MSYS2 bash.exe shell in a child process (child_process.spawn()).
 * The given argv arguments are escaped using the 'shell-escape' package,
 * so that backslashes in Windows paths, and other bash-special characters,
 * are preserved. If argv is not provided, defaults to process.argv, to the
 * effect that this current (parent) process is re-executed under MSYS2 bash.
 * This is useful to change the default shell from cmd.exe to MSYS2 bash on
 * Windows.
 * @param argv Arguments to be shell-escaped and given to MSYS2 bash.exe.
 */
export async function runUnderMsys(argv?: string[]) {
	const newArgv = argv || process.argv;
	await new Promise((resolve, reject) => {
		const args = ['-lc', shellEscape(newArgv)];
		const child = spawn(MSYS2_BASH, args, { stdio: 'inherit' });
		child.on('close', (code) => {
			if (code) {
				console.log(`runUnderMsys: child process exited with code ${code}`);
				reject(code);
			} else {
				resolve();
			}
		});
	});
}

/**
 * Run the executable at execPath as a child process, and resolve a promise
 * to the executable's stdout output as a string. Reject the promise if
 * anything is printed to stderr, or if the child process exits with a
 * non-zero exit code.
 * @param execPath Executable path
 * @param args Command-line argument for the executable
 */
export async function getSubprocessStdout(
	execPath: string,
	args: string[],
): Promise<string> {
	const child = spawn(execPath, args);
	return new Promise((resolve, reject) => {
		let stdout = '';
		child.stdout.on('error', reject);
		child.stderr.on('error', reject);
		child.stdout.on('data', (data: Buffer) => {
			try {
				stdout = data.toString();
			} catch (err) {
				reject(err);
			}
		});
		child.stderr.on('data', (data: Buffer) => {
			try {
				const stderr = data.toString();

				// ignore any debug lines, but ensure that we parse
				// every line provided to the stderr stream
				const lines = _.filter(
					stderr.trim().split(/\r?\n/),
					(line) => !line.startsWith('[debug]'),
				);
				if (lines.length > 0) {
					reject(
						new Error(`"${execPath}": non-empty stderr "${lines.join('\n')}"`),
					);
				}
			} catch (err) {
				reject(err);
			}
		});
		child.on('exit', (code: number) => {
			if (code) {
				reject(new Error(`"${execPath}": non-zero exit code "${code}"`));
			} else {
				resolve(stdout);
			}
		});
	});
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
	const whichMod = await import('which');
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
	args?: string[],
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
