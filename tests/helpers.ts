import * as path from 'path';
import * as balenaCLI from '../build/app';

export const runCommand = async (cmd: string) => {
	const preArgs = [process.argv[0], path.join(process.cwd(), 'bin', 'balena')];

	const oldStdOut = process.stdout.write;
	const oldStdErr = process.stderr.write;

	const err: string[] = [];
	const out: string[] = [];

	// @ts-ignore
	process.stdout.write = (log: string) => {
		// Skip over debug messages
		if (!log.startsWith('[debug]')) {
			out.push(log);
		}
		oldStdOut(log);
	};
	// @ts-ignore
	process.stderr.write = (log: string) => {
		// Skip over debug messages
		if (!log.startsWith('[debug]')) {
			err.push(log);
		}
		oldStdErr(log);
	};

	try {
		await balenaCLI.run(preArgs.concat(cmd.split(' ')), {
			noFlush: true,
		});

		process.stdout.write = oldStdOut;
		process.stderr.write = oldStdErr;

		return {
			err,
			out,
		};
	} catch (err) {
		process.stdout.write = oldStdOut;
		process.stderr.write = oldStdErr;

		throw err;
	}
};
