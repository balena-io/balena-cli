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
 * This module was based on the npm `umount` package:
 *     https://www.npmjs.com/package/umount
 * With some changes:
 * - Port from CoffeeScript to TypeScript
 * - Convert callbacks to async/await
 * - Fix "Command Injection" security advisory 1512
 *   https://www.npmjs.com/advisories/1512
 */

import { promisify } from 'util';
import * as child_process from 'child_process';

const execFile = promisify(child_process.execFile);

/**
 * Unmount a device on Linux or macOS. No-op on Windows.
 * @param device Device path, e.g. '/dev/disk2'
 */
export async function umount(device: string): Promise<void> {
	const cmd: string[] = [];

	if (process.platform === 'darwin') {
		cmd.push('/usr/sbin/diskutil', 'unmountDisk', 'force', device);
	} else if (process.platform === 'linux') {
		const { whichBin } = await import('./which');
		cmd.push(await whichBin('umount'), device);
	}

	if (cmd.length) {
		console.error(`umount: executing ${cmd}`);
		await execFile(cmd[0], cmd.slice(1));
	} else {
		console.error(`umount: not executing: cmd is empty`);
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
	const { whichBin } = await import('./which');
	const mountCmd = await whichBin('mount');
	const { stdout, stderr } = await execFile(mountCmd);
	if (!stderr) {
		const result = stdout.indexOf(device) !== -1;
		console.error(`isMounted: result=${result}`);
		return result;
	}
	const { ExpectedError } = await import('../errors');
	console.error(`isMounted: error: ${stderr}`);
	throw new ExpectedError(stderr);
}

/** Check if `drive` is mounted and, if so, umount it. No-op on Windows. */
export async function safeUmount(drive: string) {
	if (!drive) {
		return;
	}
	try {
		if (await isMounted(drive)) {
			await umount(drive);
		}
	} catch (err) {
		if (process.env.DEBUG) {
			console.error(`[debug] ${err.message}`);
		}
	}
}
