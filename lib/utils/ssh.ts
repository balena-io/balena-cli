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
import { spawn, StdioOptions } from 'child_process';
import * as _ from 'lodash';
import { TypedError } from 'typed-error';

import { ExpectedError } from '../errors';

export class ExecError extends TypedError {
	public cmd: string;
	public exitCode: number;

	constructor(cmd: string, exitCode: number) {
		super(`Command '${cmd}' failed with error: ${exitCode}`);
		this.cmd = cmd;
		this.exitCode = exitCode;
	}
}

export async function exec(
	deviceIp: string,
	cmd: string,
	stdout?: NodeJS.WritableStream,
): Promise<void> {
	const { which } = await import('./which');
	const program = await which('ssh');
	const args = [
		'-n',
		'-t',
		'-p',
		'22222',
		'-o',
		'LogLevel=ERROR',
		'-o',
		'StrictHostKeyChecking=no',
		'-o',
		'UserKnownHostsFile=/dev/null',
		`root@${deviceIp}`,
		cmd,
	];
	if (process.env.DEBUG) {
		const logger = (await import('./logger')).getLogger();
		logger.logDebug(`Executing [${program},${args}]`);
	}

	// Note: stdin must be 'inherit' to workaround a bug in older versions of
	// the built-in Windows 10 ssh client that otherwise prints the following
	// to stderr and hangs: "GetConsoleMode on STD_INPUT_HANDLE failed with 6"
	// They fixed the bug in newer versions of the ssh client:
	// https://github.com/PowerShell/Win32-OpenSSH/issues/856
	// but users whould have to manually download and install a new client.
	// Note that "ssh -n" does not solve the problem, but should in theory
	// prevent the ssh client from using the CLI process stdin, even if it
	// is connected with 'inherit'.
	const stdio: StdioOptions = [
		'inherit',
		stdout ? 'pipe' : 'inherit',
		'inherit',
	];

	const exitCode = await new Promise<number>((resolve, reject) => {
		const ps = spawn(program, args, { stdio })
			.on('error', reject)
			.on('close', resolve);

		if (stdout && ps.stdout) {
			ps.stdout.pipe(stdout);
		}
	});
	if (exitCode !== 0) {
		throw new ExecError(cmd, exitCode);
	}
}

export async function execBuffered(
	deviceIp: string,
	cmd: string,
	enc?: string,
): Promise<string> {
	const through = await import('through2');
	const buffer: string[] = [];
	await exec(
		deviceIp,
		cmd,
		through(function (data, _enc, cb) {
			buffer.push(data.toString(enc));
			cb();
		}),
	);
	return buffer.join('');
}

/**
 * Return a device's balenaOS release by executing 'cat /etc/os-release'
 * over ssh to the given deviceIp address.  The result is cached with
 * lodash's memoize.
 */
export const getDeviceOsRelease = _.memoize(async (deviceIp: string) =>
	execBuffered(deviceIp, 'cat /etc/os-release'),
);

// TODO: consolidate the various forms of executing ssh child processes
// in the CLI, like exec and spawn, starting with the files:
//   lib/actions/ssh.ts
//   lib/utils/ssh.ts
//   lib/utils/device/ssh.ts

/**
 * Obtain the full path for ssh using which, then spawn a child process.
 * - If the child process returns error code 0, return the function normally
 *   (do not throw an error).
 * - If the child process returns a non-zero error code, set process.exitCode
 *   to that error code, and throw ExpectedError with a warning message.
 * - If the child process is terminated by a process signal, set
 *   process.exitCode = 1, and throw ExpectedError with a warning message.
 */
export async function spawnSshAndThrowOnError(
	args: string[],
	options?: import('child_process').SpawnOptions,
) {
	const { whichSpawn } = await import('./which');
	const [exitCode, exitSignal] = await whichSpawn(
		'ssh',
		args,
		options,
		true, // returnExitCodeOrSignal
	);
	if (exitCode || exitSignal) {
		// ssh returns a wide range of exit codes, including return codes of
		// interactive shells. For example, if the user types CTRL-C on an
		// interactive shell and then `exit`, ssh returns error code 130.
		// Another example, typing "exit 1" on an interactive shell causes ssh
		// to return exit code 1. In these cases, print a short one-line warning
		// message, and exits the CLI process with the same error code.
		process.exitCode = exitCode;
		throw new ExpectedError(sshErrorMessage(exitSignal, exitCode));
	}
}

function sshErrorMessage(exitSignal?: string, exitCode?: number) {
	const msg: string[] = [];
	if (exitSignal) {
		msg.push(`Warning: ssh process was terminated with signal "${exitSignal}"`);
	} else {
		msg.push(`Warning: ssh process exited with non-zero code "${exitCode}"`);
		switch (exitCode) {
			case 255:
				msg.push(`
Are the SSH keys correctly configured in balenaCloud? See:
https://www.balena.io/docs/learn/manage/ssh-access/#add-an-ssh-key-to-balenacloud`);
				msg.push('Are you accidentally using `sudo`?');
		}
	}
	return msg.join('\n');
}
