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

export async function runUnderMsys(argv?: string[]) {
	const newArgv = argv || process.argv;
	await new Promise((resolve, reject) => {
		const cmd = 'C:\\msys64\\usr\\bin\\bash.exe';
		const args = ['-lc', shellEscape(newArgv)];
		console.log(`build-bin.ts runUnderMsys() cmd="${cmd}" args=[${args}]`);
		const ls = spawn(cmd, args, { stdio: 'inherit' });
		ls.on('close', code => {
			console.log(`child process exited with code ${code}`);
			if (code) {
				reject(code);
			} else {
				resolve();
			}
		});
	});
}

export async function run(args?: string[]) {
	args = args || process.argv.slice(2);
	console.log(`automation run.ts run process.argv=[${process.argv}]\n`);
	console.log(`automation run.ts run args=[${args}]`);
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

	// If runUnderMsys() is called to re-execute this script under Msys,
	// the current working dir becomes the Msys homedir, so we change back.
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
