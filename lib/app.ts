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
import { stripIndent } from 'common-tags';

import { exitWithExpectedError } from './utils/patterns';

/**
 * Simple command-line pre-parsing to choose between oclif or Capitano.
 * @param argv process.argv
 */
function routeCliFramework(argv: string[]): void {
	if (process.env.DEBUG) {
		console.log(
			`Debug: original argv0="${process.argv0}" argv=[${argv}] length=${argv.length}`,
		);
	}
	const cmdSlice = argv.slice(2);
	let isOclif = false;

	// Look for commands that have been deleted, to print a notice
	checkDeletedCommand(cmdSlice);

	if (cmdSlice.length > 1) {
		// convert e.g. 'balena help env add' to 'balena env add --help'
		if (cmdSlice[0] === 'help') {
			cmdSlice.shift();
			cmdSlice.push('--help');
		}

		// Look for commands that have been transitioned to oclif
		isOclif = isOclifCommand(cmdSlice);
		if (isOclif) {
			// convert space-separated commands to oclif's topic:command syntax
			argv = [
				argv[0],
				argv[1],
				cmdSlice[0] + ':' + cmdSlice[1],
				...cmdSlice.slice(2),
			];
		}
	}
	if (isOclif) {
		if (process.env.DEBUG) {
			console.log(`Debug: oclif new argv=[${argv}] length=${argv.length}`);
		}
		require('./app-oclif').run(argv);
	} else {
		require('./app-capitano');
	}
}

/**
 *
 * @param argvSlice process.argv.slice(2)
 */
function checkDeletedCommand(argvSlice: string[]): void {
	if (argvSlice[0] === 'help') {
		argvSlice = argvSlice.slice(1);
	}
	function replaced(
		oldCmd: string,
		alternative: string,
		version: string,
		verb = 'replaced',
	) {
		exitWithExpectedError(stripIndent`
			Note: the command "balena ${oldCmd}" was ${verb} in CLI version ${version}.
			Please use "balena ${alternative}" instead.
		`);
	}
	function removed(oldCmd: string, alternative: string, version: string) {
		let msg = `Note: the command "balena ${oldCmd}" was removed in CLI version ${version}.`;
		if (alternative) {
			msg = [msg, alternative].join('\n');
		}
		exitWithExpectedError(msg);
	}
	const stopAlternative =
		'Please use "balena ssh -s" to access the host OS, then use `balena-engine stop`.';
	const cmds: { [cmd: string]: [(...args: any) => void, ...string[]] } = {
		sync: [replaced, 'push', 'v11.0.0', 'removed'],
		'local logs': [replaced, 'logs', 'v11.0.0'],
		'local push': [replaced, 'push', 'v11.0.0'],
		'local scan': [replaced, 'scan', 'v11.0.0'],
		'local ssh': [replaced, 'ssh', 'v11.0.0'],
		'local stop': [removed, stopAlternative, 'v11.0.0'],
	};
	let cmd: string | undefined;
	if (argvSlice.length > 1) {
		cmd = [argvSlice[0], argvSlice[1]].join(' ');
	} else if (argvSlice.length > 0) {
		cmd = argvSlice[0];
	}
	if (cmd && Object.getOwnPropertyNames(cmds).includes(cmd)) {
		cmds[cmd][0](cmd, ...cmds[cmd].slice(1));
	}
}

/**
 * Determine whether the CLI command has been converted from Capitano to ocif.
 * @param argvSlice process.argv.slice(2)
 */
function isOclifCommand(argvSlice: string[]): boolean {
	// Look for commands that have been transitioned to oclif
	if (argvSlice.length > 1) {
		// balena env add
		if (argvSlice[0] === 'env' && argvSlice[1] === 'add') {
			return true;
		}
	}
	return false;
}

/**
 * CLI entrypoint, but see also `bin/balena` and `bin/balena-dev` which
 * call this function.
 */
export function run(): void {
	// globalInit() must be called very early on (before other imports) because
	// it sets up Sentry error reporting, global HTTP proxy settings, balena-sdk
	// shared options, and performs node version requirement checks.
	require('./app-common').globalInit();
	routeCliFramework(process.argv);
}
