/**
 * @license
 * Copyright 2021 Balena Ltd.
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

/**
 * This module was inspired by the npm `umount` package:
 *     https://www.npmjs.com/package/umount
 * With some important changes:
 * - Fix "Command Injection" security advisory 1512
 *   https://www.npmjs.com/advisories/1512
 * - Port from CoffeeScript to TypeScript
 * - Convert callbacks to async/await
 */

import * as child_process from 'child_process';
import * as path from 'path';
import { promisify } from 'util';

const execFile = promisify(child_process.execFile);

/**
 * Unmount a device on Linux or macOS. No-op on Windows.
 * @param device Device path, e.g. '/dev/disk2'
 */
export async function umount(device: string): Promise<void> {
	if (process.platform === 'win32') {
		return;
	}
	const { sanitizePath, whichBin } = await import('./which.js');
	// sanitize user's input (regular expression attacks ?)
	device = sanitizePath(device);
	const cmd: string[] = [];

	if (process.platform === 'darwin') {
		cmd.push('/usr/sbin/diskutil', 'unmountDisk', 'force', device);
	} else {
		// Linux
		const glob = promisify((await import('glob')).default);
		// '?*' expands a base device path like '/dev/sdb' to an array of paths
		// like '/dev/sdb1', '/dev/sdb2', ..., '/dev/sdb11', ... (partitions)
		// that exist for balenaOS images and are needed as arguments to 'umount'
		// on Linux (otherwise, umount produces an error "/dev/sdb: not mounted")
		const devices = await glob(`${device}?*`, { nodir: true, nonull: true });
		cmd.push(await whichBin('umount'), ...devices);
	}
	if (cmd.length > 1) {
		let stderr = '';
		try {
			const proc = await execFile(cmd[0], cmd.slice(1));
			stderr = proc.stderr;
		} catch (err) {
			const msg = [
				'',
				`Error executing "${cmd.join(' ')}"`,
				stderr || '',
				err.message || '',
			];
			if (process.platform === 'linux') {
				// ignore errors like: "umount: /dev/sdb4: not mounted."
				if (process.env.DEBUG) {
					console.error(msg.join('\n[debug] '));
				}
				return;
			}
			const { ExpectedError } = await import('../errors.js');
			throw new ExpectedError(msg.join('\n'));
		}
	}
}

/**
 * Check if a device is mounted on Linux or macOS. Always true on Windows.
 * @param device Device path, e.g. '/dev/disk2'
 */
export async function isMounted(device: string): Promise<boolean> {
	if (process.platform === 'win32') {
		return true;
	}
	if (!device) {
		return false;
	}
	const { whichBin } = await import('./which.js');
	const mountCmd = await whichBin('mount');
	let stdout = '';
	let stderr = '';
	try {
		const proc = await execFile(mountCmd);
		stdout = proc.stdout;
		stderr = proc.stderr;
	} catch (err) {
		const { ExpectedError } = await import('../errors.js');
		throw new ExpectedError(
			`Error executing "${mountCmd}":\n${stderr}\n${err.message}`,
		);
	}
	const result = (stdout || '')
		.split('\n')
		.some((line) => line.startsWith(device));
	return result;
}

/** Check if `drive` is mounted and, if so, umount it. No-op on Windows. */
export async function safeUmount(drive: string) {
	if (!drive) {
		return;
	}
	if (await isMounted(drive)) {
		await umount(drive);
	}
}

/**
 * Wrapper around the `denymount` package. See:
 * https://github.com/balena-io-modules/denymount
 */
export async function denyMount(
	target: string,
	handler: () => any,
	opts: { autoMountOnSuccess?: boolean; executablePath?: string } = {},
) {
	const denymount = promisify((await import('denymount')).default);
	if (process.pkg) {
		// when running in a standalone pkg install, the 'denymount'
		// executable is placed on the same folder as process.execPath
		opts.executablePath ||= path.join(
			path.dirname(process.execPath),
			'denymount',
		);
	}
	const dmHandler = async (cb: (err?: Error) => void) => {
		let err: Error | undefined;
		try {
			await handler();
		} catch (e) {
			err = e;
		}
		cb(err);
	};
	await denymount(target, dmHandler, opts);
}
