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

import * as _ from 'lodash';

import {
	buildOclifInstaller,
	buildStandaloneZip,
	fixPathForMsys,
	ROOT,
	runUnderMsys,
} from './build-bin';
import { release } from './deploy-bin';

/**
 * Trivial command-line parser. Check whether the command-line argument is one
 * of the following strings, then call the appropriate functions:
 *     'build:installer'   (to build a native oclif installer)
 * 	   'build:standalone'  (to build a standalone pkg package)
 *     'release'           (to create/update a GitHub release)
 *
 * In the case of 'build:installer', also call runUnderMsys() to switch the
 * shell from cmd.exe to MSYS2 bash.exe.
 *
 * @param args Arguments to parse (default is process.argv.slice(2))
 */
export async function run(args?: string[]) {
	args = args || process.argv.slice(2);
	console.log(`automation/run.ts process.argv=[${process.argv}]\n`);
	console.log(`automation/run.ts args=[${args}]`);
	if (_.isEmpty(args)) {
		console.error('Error: missing args');
		process.exit(1);
	}
	const commands: { [cmd: string]: () => void } = {
		'build:installer': buildOclifInstaller,
		'build:standalone': buildStandaloneZip,
		release,
	};
	for (const arg of args) {
		if (!commands.hasOwnProperty(arg)) {
			throw new Error(`Error: unknown build target: ${arg}`);
		}
	}

	// If runUnderMsys() is called to re-execute this script under MSYS2,
	// the current working dir becomes the MSYS2 homedir, so we change back.
	process.chdir(ROOT);

	// The BUILD_TMP env var is used as an alternative location for oclif
	// (patched) to copy/extract the CLI files, run npm install and then
	// create the NSIS executable installer for Windows. This was necessary
	// to avoid issues with a 260-char limit on Windows paths (possibly a
	// limitation of some library used by NSIS), as the "current working dir"
	// provided by balena CI is a rather long path to start with.
	if (process.platform === 'win32' && !process.env.BUILD_TMP) {
		const randID = require('crypto')
			.randomBytes(6)
			.toString('base64')
			.replace(/\+/g, '-')
			.replace(/\//g, '_'); // base64url (RFC 4648)
		process.env.BUILD_TMP = `C:\\tmp\\${randID}`;
	}

	for (const arg of args) {
		try {
			if (arg === 'build:installer' && process.platform === 'win32') {
				// ensure running under MSYS2
				if (!process.env.MSYSTEM) {
					process.env.MSYS2_PATH_TYPE = 'inherit';
					await runUnderMsys([
						fixPathForMsys(process.argv[0]),
						fixPathForMsys(process.argv[1]),
						arg,
					]);
					continue;
				}
				if (process.env.MSYS2_PATH_TYPE !== 'inherit') {
					throw new Error(
						'the MSYS2_PATH_TYPE env var must be set to "inherit"',
					);
				}
			}
			const cmdFunc = commands[arg];
			await cmdFunc();
		} catch (err) {
			console.log(`Error running command "${arg}": ${err}`);
			process.exit(1);
		}
	}
}

run();
