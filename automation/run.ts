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

import { spawn } from 'child_process';
import * as _ from 'lodash';
import * as shellEscape from 'shell-escape';

import {
	buildOclifInstaller,
	buildPkg,
	fixPathForMsys,
	ROOT,
} from './build-bin';
import { release } from './deploy-bin';

/**
 * Run the MSYS2 bash.exe shell in a child process (child_process.spawn()).
 * The given argv arguments are escaped using the 'shell-escape' package,
 * so that backslashes in Windows paths, and other bash-special characters,
 * are preserved. If argv is not provided, defaults to process.argv, to the
 * effect that this current (parent) process is re-executed under MSYS2 bash.
 * This is useful to change the default shell from cmd.exe to MSYS2 bash on
 * Windows.
 * @param argv Arguments to be shell-escaped and given to MSYS2 bash.exe.
 */
export async function runUnderMsys(argv?: string[]) {
	const newArgv = argv || process.argv;
	await new Promise((resolve, reject) => {
		const cmd = 'C:\\msys64\\usr\\bin\\bash.exe';
		const args = ['-lc', shellEscape(newArgv)];
		const child = spawn(cmd, args, { stdio: 'inherit' });
		child.on('close', code => {
			if (code) {
				console.log(`runUnderMsys: child process exited with code ${code}`);
				reject(code);
			} else {
				resolve();
			}
		});
	});
}

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
		'build:standalone': buildPkg,
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

	for (const arg of args) {
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
				throw new Error('the MSYS2_PATH_TYPE env var must be set to "inherit"');
			}
		}
		await commands[arg]();
	}
}

run();
