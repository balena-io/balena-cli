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

import type { Interfaces } from '@oclif/core';

export let unsupportedFlag = false;

export interface AppOptions {
	// Prevent the default behavior of flushing stdout after running a command
	noFlush?: boolean;
	development?: boolean;
	dir: string;
	loadOptions?: Interfaces.LoadOptions;
}

export async function preparseArgs(argv: string[]): Promise<string[]> {
	if (process.env.DEBUG) {
		console.log(
			`[debug] original argv0="${process.argv0}" argv=[${argv}] length=${argv.length}`,
		);
	}
	const cmdSlice = argv.slice(2);

	if (cmdSlice.length > 0) {
		// convert 'balena --version' or 'balena -v' to 'balena version'
		if (['--version', '-v'].includes(cmdSlice[0])) {
			cmdSlice[0] = 'version';
		}
		// convert 'balena --help' or 'balena -h' to 'balena help'
		else if (['--help', '-h'].includes(cmdSlice[0])) {
			cmdSlice[0] = 'help';
		}
		// convert e.g. 'balena help env add' to 'balena env add --help'
		if (
			cmdSlice.length > 1 &&
			cmdSlice[0] === 'help' &&
			cmdSlice[1][0] !== '-'
		) {
			cmdSlice.shift();
			cmdSlice.push('--help');
		}

		// support global --debug flag
		if (extractBooleanFlag(cmdSlice, '--debug')) {
			process.env.DEBUG = '1';
		}
		unsupportedFlag = extractBooleanFlag(cmdSlice, '--unsupported');
	}

	// Enable bluebird long stack traces when in debug mode, must be set
	// before the first bluebird require - done here so that it will also
	// be enabled when using the `--debug` flag to enable debug mode
	if (process.env.DEBUG) {
		process.env.BLUEBIRD_LONG_STACK_TRACES = '1';
	}

	const { default: Logger } = await import('./utils/logger.js');
	Logger.command = cmdSlice[0];

	let args = cmdSlice;

	// Convert space separated subcommands (e.g. `end add`), to colon-separated format (e.g. `env:add`)
	if (await isSubcommand(cmdSlice)) {
		// convert space-separated commands to oclif's topic:command syntax
		args = [cmdSlice[0] + ':' + cmdSlice[1], ...cmdSlice.slice(2)];
		Logger.command = `${cmdSlice[0]} ${cmdSlice[1]}`;
	}

	if (process.env.DEBUG) {
		console.log(
			`[debug] new argv=[${[argv[0], argv[1], ...args]}] length=${
				args.length + 2
			}`,
		);
	}

	return args;
}

function extractBooleanFlag(argv: string[], flag: string): boolean {
	const index = argv.indexOf(flag);
	if (index >= 0) {
		argv.splice(index, 1);
		return true;
	}
	return false;
}

/**
 * Check whether the command line refers to a command that has been deprecated
 * and removed and, if so, exit with an informative error message.
 */
export async function checkDeletedCommand(argvSlice: string[]): Promise<void> {
	const { ExpectedError } = await import('./errors.js');

	if (argvSlice[0] === 'help') {
		argvSlice = argvSlice.slice(1);
	}
	function replaced(
		oldCmd: string,
		alternative: string,
		version: string,
		verb = 'replaced',
	) {
		throw new ExpectedError(`\
Note: the command "balena ${oldCmd}" was ${verb} in CLI version ${version}.
Please use "balena ${alternative}" instead.`);
	}
	function removed(oldCmd: string, alternative: string, version: string) {
		let msg = `Note: the command "balena ${oldCmd}" was removed in CLI version ${version}.`;
		if (alternative) {
			msg = [msg, alternative].join('\n');
		}
		throw new ExpectedError(msg);
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
		app: [replaced, 'fleet', 'v13.0.0'],
		apps: [replaced, 'fleets', 'v13.0.0'],
		'app purge': [replaced, 'fleet purge', 'v13.0.0'],
		'app rename': [replaced, 'fleet rename', 'v13.0.0'],
		'app restart': [replaced, 'fleet restart', 'v13.0.0'],
		'app rm': [replaced, 'fleet rm', 'v13.0.0'],
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

// Check if this is a space separated 'topic command' style command subcommand (e.g. `end add`)
// by comparing with oclif style colon-separated subcommand list (e.g. `env:add`)
export async function isSubcommand(args: string[]) {
	const { getCommandIdsFromManifest } = await import('./utils/oclif-utils.js');
	const commandIds = await getCommandIdsFromManifest();
	return commandIds.includes(`${args[0] || ''}:${args[1] || ''}`);
}
