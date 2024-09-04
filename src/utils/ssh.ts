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
import type { StdioOptions } from 'child_process';
import { spawn } from 'child_process';
import _ from 'lodash';

import { ExpectedError } from '../errors.js';

export class SshPermissionDeniedError extends ExpectedError {}

export class RemoteCommandError extends ExpectedError {
	cmd: string;
	exitCode?: number;
	exitSignal?: NodeJS.Signals;

	constructor(cmd: string, exitCode?: number, exitSignal?: NodeJS.Signals) {
		super(sshErrorMessage(cmd, exitSignal, exitCode));
		this.cmd = cmd;
		this.exitCode = exitCode;
		this.exitSignal = exitSignal;
	}
}

export interface SshRemoteCommandOpts {
	cmd?: string;
	hostname: string;
	ignoreStdin?: boolean;
	port?: number | 'cloud' | 'local';
	proxyCommand?: string[];
	username?: string;
	verbose?: boolean;
}

export const stdioIgnore: {
	stdin: 'ignore';
	stdout: 'ignore';
	stderr: 'ignore';
} = {
	stdin: 'ignore',
	stdout: 'ignore',
	stderr: 'ignore',
};

export function sshArgsForRemoteCommand({
	cmd = '',
	hostname,
	ignoreStdin = false,
	port,
	proxyCommand,
	username = 'root',
	verbose = false,
}: SshRemoteCommandOpts): string[] {
	port = port === 'local' ? 22222 : port === 'cloud' ? 22 : port;
	return [
		...(verbose ? ['-vvv'] : []),
		...(ignoreStdin ? ['-n'] : []),
		'-t',
		...(port ? ['-p', port.toString()] : []),
		...['-o', 'LogLevel=ERROR'],
		...['-o', 'StrictHostKeyChecking=no'],
		...['-o', 'UserKnownHostsFile=/dev/null'],
		...(proxyCommand && proxyCommand.length
			? ['-o', `ProxyCommand=${proxyCommand.join(' ')}`]
			: []),
		`${username}@${hostname}`,
		...(cmd ? [cmd] : []),
	];
}

/**
 * Execute the given command on a local balenaOS device over ssh.
 * @param cmd Shell command to execute on the device
 * @param hostname Device's hostname or IP address
 * @param port SSH server TCP port number or 'local' (22222) or 'cloud' (22)
 * @param stdin Readable stream to pipe to the remote command stdin,
 * or 'ignore' or 'inherit' as documented in the child_process.spawn function.
 * @param stdout Writeable stream to pipe from the remote command stdout,
 * or 'ignore' or 'inherit' as documented in the child_process.spawn function.
 * @param stderr Writeable stream to pipe from the remote command stdout,
 * or 'ignore' or 'inherit' as documented in the child_process.spawn function.
 * @param username SSH username for authorization. With balenaOS 2.44.0 or
 * later, it can be a balenaCloud username.
 * @param verbose Produce debugging output
 */
export async function runRemoteCommand({
	cmd = '',
	hostname,
	port,
	proxyCommand,
	stdin = 'inherit',
	stdout = 'inherit',
	stderr = 'inherit',
	username = 'root',
	verbose = false,
}: SshRemoteCommandOpts & {
	stdin?: 'ignore' | 'inherit' | NodeJS.ReadableStream;
	stdout?: 'ignore' | 'inherit' | NodeJS.WritableStream;
	stderr?: 'ignore' | 'inherit' | NodeJS.WritableStream;
}): Promise<void> {
	let ignoreStdin: boolean;
	if (stdin === 'ignore') {
		// Set ignoreStdin=true in order for the "ssh -n" option to be used to
		// prevent the ssh client from using the CLI process stdin. In addition,
		// stdin must be forced to 'inherit' (if it is not a readable stream) in
		// order to work around a bug in older versions of the built-in Windows
		// 10 ssh client that otherwise prints the following to stderr and
		// hangs:  "GetConsoleMode on STD_INPUT_HANDLE failed with 6"
		// They actually fixed the bug in newer versions of the ssh client:
		// https://github.com/PowerShell/Win32-OpenSSH/issues/856 but users
		// have to manually download and install a new client.
		ignoreStdin = true;
		stdin = 'inherit';
	} else {
		ignoreStdin = false;
	}
	const { which } = await import('./which.js');
	const program = await which('ssh');
	const args = sshArgsForRemoteCommand({
		cmd,
		hostname,
		ignoreStdin,
		port,
		proxyCommand,
		username,
		verbose,
	});

	if (process.env.DEBUG) {
		const logger = (await import('./logger.js')).default.getLogger();
		logger.logDebug(`Executing [${program},${args}]`);
	}

	const stdio: StdioOptions = [
		typeof stdin === 'string' ? stdin : 'pipe',
		typeof stdout === 'string' ? stdout : 'pipe',
		typeof stderr === 'string' ? stderr : 'pipe',
	];
	let exitCode: number | undefined;
	let exitSignal: NodeJS.Signals | undefined;
	try {
		[exitCode, exitSignal] = await new Promise((resolve, reject) => {
			const ps = spawn(program, args, { stdio })
				.on('error', reject)
				.on('close', (code, signal) =>
					resolve([code ?? undefined, signal ?? undefined]),
				);

			if (ps.stdin && stdin && typeof stdin !== 'string') {
				stdin.pipe(ps.stdin);
			}
			if (ps.stdout && stdout && typeof stdout !== 'string') {
				ps.stdout.pipe(stdout);
			}
			if (ps.stderr && stderr && typeof stderr !== 'string') {
				ps.stderr.pipe(stderr);
			}
		});
	} catch (error) {
		const msg = [
			`ssh failed with exit code=${exitCode} signal=${exitSignal}:`,
			`[${program}, ${args.join(', ')}]`,
			...(error ? [`${error}`] : []),
		];
		throw new ExpectedError(msg.join('\n'));
	}
	if (exitCode || exitSignal) {
		throw new RemoteCommandError(cmd, exitCode, exitSignal);
	}
}

/**
 * Execute the given command on a local balenaOS device over ssh.
 * Capture stdout and/or stderr to Buffers and return them.
 *
 * @param deviceIp IP address of the local device
 * @param cmd Shell command to execute on the device
 * @param opts Options
 * @param opts.username SSH username for authorization. With balenaOS 2.44.0 or
 * later, it may be a balenaCloud username. Otherwise, 'root'.
 * @param opts.stdin Passed through to the runRemoteCommand function
 * @param opts.stdout If 'capture', capture stdout to a Buffer.
 * @param opts.stderr If 'capture', capture stdout to a Buffer.
 */
export async function getRemoteCommandOutput({
	cmd,
	hostname,
	port,
	proxyCommand,
	stdin = 'ignore',
	stdout = 'capture',
	stderr = 'capture',
	username = 'root',
	verbose = false,
}: SshRemoteCommandOpts & {
	stdin?: 'ignore' | 'inherit' | NodeJS.ReadableStream;
	stdout?: 'capture' | 'ignore' | 'inherit' | NodeJS.WritableStream;
	stderr?: 'capture' | 'ignore' | 'inherit' | NodeJS.WritableStream;
}): Promise<{ stdout: Buffer; stderr: Buffer }> {
	const { Writable } = await import('stream');
	const stdoutChunks: Buffer[] = [];
	const stderrChunks: Buffer[] = [];
	const stdoutStream = new Writable({
		write(chunk: Buffer, _enc, callback) {
			stdoutChunks.push(chunk);
			callback();
		},
	});
	const stderrStream = new Writable({
		write(chunk: Buffer, _enc, callback) {
			stderrChunks.push(chunk);
			callback();
		},
	});
	await runRemoteCommand({
		cmd,
		hostname,
		port,
		proxyCommand,
		stdin,
		stdout: stdout === 'capture' ? stdoutStream : stdout,
		stderr: stderr === 'capture' ? stderrStream : stderr,
		username,
		verbose,
	});
	return {
		stdout: Buffer.concat(stdoutChunks),
		stderr: Buffer.concat(stderrChunks),
	};
}

/** Convenience wrapper for getRemoteCommandOutput */
export async function getLocalDeviceCmdStdout(
	hostname: string,
	cmd: string,
	stdout: 'capture' | 'ignore' | 'inherit' | NodeJS.WritableStream = 'capture',
): Promise<Buffer> {
	const port = 'local';
	return (
		await getRemoteCommandOutput({
			cmd,
			hostname,
			port,
			stdout,
			stderr: 'inherit',
			username: await findBestUsernameForDevice(hostname, port),
		})
	).stdout;
}

/**
 * Run a trivial 'exit 0' command over ssh on the target hostname (typically the
 * IP address of a local device) with the 'root' username, in order to determine
 * whether root authentication suceeds. It should succeed with development
 * variants of balenaOS and fail with production variants, unless a ssh key was
 * added to the device's 'config.json' file.
 * @return True if succesful, false on any errors.
 */
export const isRootUserGood = _.memoize(async (hostname: string, port) => {
	try {
		await runRemoteCommand({ cmd: 'exit 0', hostname, port, ...stdioIgnore });
	} catch (e) {
		return false;
	}
	return true;
});

/**
 * Determine whether the given local device (hostname or IP address) should be
 * accessed as the 'root' user or as a regular cloud user (balenaCloud or
 * openBalena). Where possible, the root user is preferable because:
 * - It allows ssh to be used in air-gapped scenarios (no internet access).
 *   Logging in as a regular user requires the device to fetch public keys from
 *   the cloud backend.
 * - Root authentication is significantly faster for local devices (a fraction
 *   of a second versus 5+ seconds).
 * - Non-root authentication requires balenaOS v2.44.0 or later, so not (yet)
 *   universally possible.
 */
export const findBestUsernameForDevice = _.memoize(
	async (hostname: string, port): Promise<string> => {
		let username: string | undefined;
		if (await isRootUserGood(hostname, port)) {
			username = 'root';
		} else {
			const { getCachedUsername } = await import('./bootstrap.js');
			username = (await getCachedUsername())?.username;
		}
		if (!username) {
			const { stripIndent } = await import('./lazy.js');
			throw new ExpectedError(stripIndent`
				SSH authentication failed for 'root@${hostname}'.
				Please login with 'balena login' for alternative authentication.`);
		}
		return username;
	},
);

/**
 * Return a device's balenaOS release by executing 'cat /etc/os-release'
 * over ssh to the given deviceIp address.  The result is cached with
 * lodash's memoize.
 */
export const getDeviceOsRelease = _.memoize(async (hostname: string) =>
	(await getLocalDeviceCmdStdout(hostname, 'cat /etc/os-release')).toString(),
);

function sshErrorMessage(cmd: string, exitSignal?: string, exitCode?: number) {
	const msg: string[] = [];
	cmd = cmd ? `Remote command "${cmd}"` : 'Process';
	if (exitSignal) {
		msg.push(`SSH: ${cmd} terminated with signal "${exitSignal}"`);
	} else {
		msg.push(`SSH: ${cmd} exited with non-zero status code "${exitCode}"`);
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
