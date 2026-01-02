import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

let disposableSet: Set<Disposable> | undefined;
const disposableSetGC = () => {
	if (disposableSet == null) {
		return;
	}
	for (const item of disposableSet) {
		item[Symbol.dispose]();
	}
	process.removeListener('exit', disposableSetGC);
};

/* Disposable-based replacement for tmp.setGracefulCleanup(); */
export const mkdtempDisposableSyncGraceful = (
	prefix?: string,
	options?: fs.EncodingOption,
) => {
	prefix ??= path.join(tmpdir(), 'balena-cli-');
	if (disposableSet == null) {
		disposableSet = new Set<Disposable>();
		// https://github.com/raszi/node-tmp/blob/v0.2.5/lib/tmp.js#L732
		process.addListener('exit', disposableSetGC);
	}
	const logDebug = process.env.DEBUG
		? (() => {
				const Logger = require('./logger') as typeof import('./logger');
				const logger = Logger.getLogger();
				return (msg: string) => logger.logDebug(msg);
			})()
		: undefined;
	const tempDir = fs.mkdtempDisposableSync(prefix, options);
	const remove = () => {
		disposableSet?.delete(result);
		tempDir.remove();
		logDebug?.(`Removed temporary directory '${tempDir.path}'`);
	};
	const result = {
		...tempDir,
		remove,
		[Symbol.dispose]: remove,
	};
	disposableSet.add(result);
	return result;
};
