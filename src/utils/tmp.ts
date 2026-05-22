import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

const logDebug = process.env.DEBUG
	? (() => {
			const Logger = require('./logger') as typeof import('./logger');
			const logger = Logger.getLogger();
			return (msg: string) => logger.logDebug(msg);
		})()
	: undefined;

export async function getDiskTmpDir() {
	const tmpDirPath = tmpdir();
	// On linux /tmp is often a tmpfs in-memory filesystem (eg since Ubuntu 24.10),
	// which can cause out-of-memory errors when handling large files.
	if (
		process.platform === 'linux' &&
		tmpDirPath === '/tmp' &&
		// See: https://github.com/nodejs/node/blob/v26.2.0/lib/os.js#L181
		// See: https://github.com/nodejs/node/blob/v26.2.0/src/node_credentials.cc#L132
		!process.env.TMPDIR &&
		!process.env.TMP &&
		!process.env.TEMP
	) {
		const { getBalenaSdk } = await import('./lazy');
		const sdk = getBalenaSdk();
		const dataDirectory = await sdk.settings.get('dataDirectory');
		const homeBalenaTmp = path.join(dataDirectory, 'balena-cli-tmp');
		try {
			await fs.promises.mkdir(homeBalenaTmp, { recursive: true });
			fs.accessSync(homeBalenaTmp, fs.constants.W_OK);
			return homeBalenaTmp;
		} catch {
			logDebug?.(
				`Unable to use '${homeBalenaTmp}' as temporary directory, falling back to default tmpdir()`,
			);
		}
	}

	return tmpDirPath;
}

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
