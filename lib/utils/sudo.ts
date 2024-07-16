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

import type { ChildProcess, SpawnOptions } from 'child_process';
import { spawn } from 'child_process';
import { stripIndent } from './lazy.js';

/**
 * Execute a child process with admin / superuser privileges, prompting the user for
 * elevation as needed, and taking care of shell-escaping arguments in a suitable way
 * for Windows and Linux/Mac.
 *
 * @param command Unescaped array of command and args to be executed. If isCLIcmd is
 * true, the command should not include the 'node' or 'balena' components, for
 * example: ['internal', 'osinit', ...]. This function will add argv[0] and argv[1]
 * as needed (taking process.pkg into account -- CLI standalone zip package), and
 * will also shell-escape the arguments as needed, taking into account the
 * differences between bash/sh and the Windows cmd.exe in relation to escape
 * characters.
 * @param stderr Optional stream to which stderr should be piped
 * @param isCLIcmd (default: true) Whether the command array is a balena CLI command
 * (e.g. ['internal', 'osinit', ...]), in which case process.argv[0] and argv[1] are
 * added as necessary, depending on whether the CLI is running as a standalone zip
 * package (with Node built in).
 */
export async function executeWithPrivileges(
	command: string[],
	stderr?: NodeJS.WritableStream,
	isCLIcmd = true,
): Promise<void> {
	// whether the CLI is already running with admin / super user privileges
	const isElevated = await (await import('is-elevated')).default();
	const { shellEscape } = await import('./helpers.js');
	const opts: SpawnOptions = {
		env: process.env,
		stdio: ['inherit', 'inherit', stderr ? 'pipe' : 'inherit'],
	};
	if (isElevated) {
		if (isCLIcmd) {
			// opts.shell is false, so preserve pkg's '/snapshot' at argv[1]
			command = [process.argv[0], process.argv[1], ...command];
		}
		// already running with privileges: simply spawn the command
		await spawnAndPipe(command[0], command.slice(1), opts, stderr);
	} else {
		if (isCLIcmd) {
			// In the case of a CLI standalone zip package (process.pkg is truthy),
			// the Node executable is bundled with the source code and node_modules
			// folder in a single file named in argv[0]. In this case, argv[1]
			// contains a "/snapshot" path that should be discarded when opts.shell
			// is true.
			command = (process as any).pkg
				? [process.argv[0], ...command]
				: [process.argv[0], process.argv[1], ...command];
		}
		opts.shell = true;
		const escapedCmd = shellEscape(command);
		// running as ordinary user: elevate privileges
		if (process.platform === 'win32') {
			await windosuExec(escapedCmd, stderr);
		} else {
			await spawnAndPipe('sudo', escapedCmd, opts, stderr);
		}
	}
}

async function spawnAndPipe(
	spawnCmd: string,
	spawnArgs: string[],
	spawnOpts: SpawnOptions,
	stderr?: NodeJS.WritableStream,
) {
	await new Promise<void>((resolve, reject) => {
		const ps: ChildProcess = spawn(spawnCmd, spawnArgs, spawnOpts);
		ps.on('error', reject);
		ps.on('exit', (codeOrSignal) => {
			if (codeOrSignal !== 0) {
				const errMsgCmd = `[${[spawnCmd, ...spawnArgs].join()}]`;
				reject(
					new Error(
						`Child process exited with error code "${codeOrSignal}" for command:\n${errMsgCmd}`,
					),
				);
			} else {
				resolve();
			}
		});
		if (stderr && ps.stderr) {
			ps.stderr.pipe(stderr);
		}
	});
}

async function windosuExec(
	escapedArgs: string[],
	stderr?: NodeJS.WritableStream,
): Promise<void> {
	if (stderr) {
		const msg = stripIndent`
			Error: unable to elevate privileges. Please run the command prompt as an Administrator:
			https://www.howtogeek.com/194041/how-to-open-the-command-prompt-as-administrator-in-windows-8.1/
		`;
		throw new Error(msg);
	}

	const {
		default: { createRequire },
	} = await import('node:module');
	const require = createRequire(import.meta.url);
	return require('windosu').exec(escapedArgs.join(' '));
}
