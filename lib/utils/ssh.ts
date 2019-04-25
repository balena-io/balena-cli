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
import * as Bluebird from 'bluebird';
import { spawn, StdioOptions } from 'child_process';
import { TypedError } from 'typed-error';

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

	const stdio: StdioOptions = ['ignore', stdout ? 'pipe' : 'inherit', 'ignore'];
	const { program, args } = getSubShellCommand(command);

	const exitCode = await new Bluebird<number>((resolve, reject) => {
		const ps = spawn(program, args, { stdio })
			.on('error', reject)
			.on('close', resolve);

		if (stdout) {
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
		through(function(data, _enc, cb) {
			buffer.push(data.toString(enc));
			cb();
		}),
	);
	return buffer.join('');
}
