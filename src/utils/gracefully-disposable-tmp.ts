import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

let disposableSet: Set<Disposable> | undefined;
const disposableSetGC = () => {
	if (disposableSet == null) {
		return;
	}
	// https://github.com/raszi/node-tmp/blob/v0.2.5/lib/tmp.js#L368
	for (const item of disposableSet) {
		try {
			item[Symbol.dispose]();
		} catch {
			// already removed?
		}
	}
	process.removeListener('exit', disposableSetGC);
};

const logDebug = process.env.DEBUG
	? (() => {
			const Logger = require('./logger') as typeof import('./logger');
			const logger = Logger.getLogger();
			return (msg: string) => logger.logDebug(msg);
		})()
	: undefined;

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
	const tempDir = fs.mkdtempDisposableSync(prefix, options);
	const remove = () => {
		try {
			disposableSet?.delete(result);
			tempDir.remove();
			logDebug?.(`Removed temporary directory '${tempDir.path}'`);
		} catch (e) {
			logDebug?.(
				`Failed to remove temporary directory '${tempDir.path}': ${e}`,
			);
			throw e;
		}
	};
	const result = {
		...tempDir,
		remove,
		[Symbol.dispose]: remove,
	};
	disposableSet.add(result);
	return result;
};
