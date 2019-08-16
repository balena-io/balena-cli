import * as nock from 'nock';
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
		if (
			!log.startsWith('[debug]') &&
			// TODO stop this warning message from appearing when running
			// sdk.setSharedOptions multiple times in the same process
			!log.startsWith('Shared SDK options')
		) {
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

export const balenaAPIMock = () => {
	return nock(/./)
		.get('/config/vars')
		.reply(200, {
			reservedNames: [],
			reservedNamespaces: [],
			invalidRegex: '/^d|W/',
			whiteListedNames: [],
			whiteListedNamespaces: [],
			blackListedNames: [],
			configVarSchema: [],
		});
};
