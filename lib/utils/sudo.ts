import { spawn } from 'child_process';

import * as Bluebird from 'bluebird';
import * as rindle from 'rindle';

export async function executeWithPrivileges(
	command: string[],
	stderr?: NodeJS.WritableStream,
): Promise<void> {
	const opts = {
		stdio: ['inherit', 'inherit', stderr ? 'pipe' : 'inherit'],
		env: process.env,
	};

	const args = process.argv
		.slice(0, 2)
		.concat(['internal', 'sudo', command.join(' ')]);

	const ps = spawn(args[0], args.slice(1), opts);

	if (stderr) {
		ps.stderr.pipe(stderr);
	}

	return Bluebird.fromCallback(resolver => rindle.wait(ps, resolver));
}
