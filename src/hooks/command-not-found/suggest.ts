/**
 * @license
 * Copyright 2019-2020 Balena Ltd.
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

import type { Hook, Interfaces } from '@oclif/core';
import { getChalk } from '../../utils/lazy.js';

/*
 A modified version of the command-not-found plugin logic,
 which deals with spaces separators stead of colons, and
 prints suggested commands instead of prompting interactively.

 Also see help.ts showHelp() for handling of topics.
 */

const hook: Hook<'command-not-found'> = async function (
	opts: object & { config: Interfaces.Config; id?: string; argv?: string[] },
) {
	const Levenshtein = await import('fast-levenshtein');
	const _ = await import('lodash');
	const chalk = getChalk();

	const commandId = opts.id || '';
	const command = opts.id?.replace(':', ' ') || '';

	const commandIDs = [
		...opts.config.commandIDs,
		..._.flatten(opts.config.commands.map((c) => c.aliases)),
		'version',
	];

	function closest(cmd: string) {
		return _.minBy(commandIDs, (c) => Levenshtein.get(cmd, c))!;
	}

	const suggestions: string[] = [];
	suggestions.push(closest(commandId).replace(':', ' ') || '');

	// opts.argv contains everything after the first command word
	// if there's something there, also test if it might be a double
	// word command spelt wrongly, rather than command args.
	if (opts.argv?.[0]) {
		suggestions.unshift(
			closest(`${commandId}: + ${opts.argv[0]}`).replace(':', ' ') || '',
		);
	}

	// Output suggestions
	console.error(
		`${chalk.yellow(command)} is not a recognized balena command.\n`,
	);
	console.error(`Did you mean: ? `);
	suggestions.forEach((s) => {
		console.error(`  ${chalk.cyan.bold(s)}`);
	});
	console.error(
		`\nRun ${chalk.cyan.bold(
			'balena help -v',
		)} for a list of available commands,`,
	);
	console.error(
		` or ${chalk.cyan.bold(
			'balena help <command>',
		)} for detailed help on a specific command.`,
	);

	// Exit
	const COMMAND_NOT_FOUND = 127;
	process.exit(COMMAND_NOT_FOUND);
};

export default hook;
