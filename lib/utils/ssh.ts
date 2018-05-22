import { spawn } from 'child_process';
import * as Bluebird from 'bluebird';
import TypedError = require('typed-error');

import { getSubShellCommand } from './helpers';

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
	const command = `ssh \
		-t \
		-p 22222 \
		-o LogLevel=ERROR \
		-o StrictHostKeyChecking=no \
		-o UserKnownHostsFile=/dev/null \
		root@${deviceIp} \
		${cmd}`;

	const stdio = ['ignore', stdout ? 'pipe' : 'inherit', 'ignore'];
	const { program, args } = getSubShellCommand(command);

	const exitCode = await new Bluebird<number>((resolve, reject) => {
		const ps = spawn(program, args, { stdio })
			.on('error', reject)
			.on('close', resolve);

		if (stdout) {
			ps.stdout.pipe(stdout);
		}
	});
	if (exitCode != 0) {
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
		through(function(data, _enc, cb) {
			buffer.push(data.toString(enc));
			cb();
		}),
	);
	return buffer.join('');
}
