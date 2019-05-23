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

import { run as oclifRun } from '@oclif/dev-cli';
import * as Bluebird from 'bluebird';
import * as filehound from 'filehound';
import * as fs from 'fs-extra';
import * as path from 'path';
import { exec as execPkg } from 'pkg';
import * as rimraf from 'rimraf';

export const ROOT = path.join(__dirname, '..');

/**
 * Use the 'pkg' module to create a single large executable file with
 * the contents of 'node_modules' and the CLI's javascript code.
 * Also copy a number of native modules (binary '.node' files) that are
 * compiled during 'npm install' to the 'build-bin' folder, alongside
 * the single large executable file created by pkg. (This is necessary
 * because of a pkg limitation that does not allow binary executables
 * to be directly executed from inside another binary executable.)
 */
export async function buildPkg() {
	console.log('Building package...\n');

	await execPkg([
		'--target',
		'host',
		'--output',
		'build-bin/balena',
		'package.json',
	]);
	const xpaths: Array<[string, string[]]> = [
		// [platform, [path, to, file]]
		['*', ['opn', 'xdg-open']],
		['darwin', ['denymount', 'bin', 'denymount']],
	];
	await Bluebird.map(xpaths, ([platform, xpath]) => {
		if (platform === '*' || platform === process.platform) {
			// eg copy from node_modules/opn/xdg-open to build-bin/xdg-open
			return fs.copy(
				path.join(ROOT, 'node_modules', ...xpath),
				path.join(ROOT, 'build-bin', xpath.pop()!),
			);
		}
	});
	const nativeExtensionPaths: string[] = await filehound
		.create()
		.paths(path.join(ROOT, 'node_modules'))
		.ext(['node', 'dll'])
		.find();

	console.log(`\nCopying to build-bin:\n${nativeExtensionPaths.join('\n')}`);

	await Bluebird.map(nativeExtensionPaths, extPath =>
		fs.copy(
			extPath,
			extPath.replace(
				path.join(ROOT, 'node_modules'),
				path.join(ROOT, 'build-bin'),
			),
		),
	);
}

/**
 * Run the `oclif-dev pack:win` or `pack:macos` command (depending on the value
 * of process.platform) to generate the native installers (which end up under
 * the 'dist' folder). There are some harcoded options such as selecting only
 * 64-bit binaries under Windows.
 */
export async function buildOclifInstaller() {
	console.log(`buildOclifInstaller cwd="${process.cwd()}" ROOT="${ROOT}"`);
	let packOS = '';
	let packOpts = ['-r', ROOT];
	if (process.platform === 'darwin') {
		packOS = 'macos';
	} else if (process.platform === 'win32') {
		packOS = 'win';
		packOpts = packOpts.concat('-t', 'win32-x64');
	}
	if (packOS) {
		const packCmd = `pack:${packOS}`;
		const dirs = [path.join(ROOT, 'dist', packOS)];
		if (packOS === 'win') {
			dirs.push(path.join(ROOT, 'tmp', 'win*'));
		}
		for (const dir of dirs) {
			console.log(`rimraf(${dir})`);
			await Bluebird.fromCallback(cb => rimraf(dir, cb));
		}
		console.log('=======================================================');
		console.log(`oclif-dev "${packCmd}" [${packOpts}]`);
		console.log('=======================================================');
		oclifRun([packCmd].concat(...packOpts));
	}
}

/**
 * Convert e.g. 'C:\myfolder' -> '/C/myfolder' so that the path can be given
 * as argument to "unix tools" like 'tar' under MSYS or MSYS2 on Windows.
 */
export function fixPathForMsys(p: string): string {
	return p.replace(/\\/g, '/').replace(/^([a-zA-Z]):/, '/$1');
}
