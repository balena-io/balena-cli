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

import { Hook } from '@oclif/config';
import type { IConfig } from '@oclif/config';

/*
 A modified version of the command-not-found plugin logic,
 which deals with spaces separators stead of colons, and
 prints suggested commands instead of prompting interactively.
 */

const hook: Hook<'command-not-found'> = async function (
	opts: object & { config: IConfig; id?: string },
) {
	const Levenshtein = await import('fast-levenshtein');
	const _ = await import('lodash');
	const { color } = await import('@oclif/color');

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

	console.error(
		`${color.yellow(command)} is not a recognized balena command.\n`,
	);

	const suggestion = closest(commandId).replace(':', ' ') || '';
	console.log(`Did you mean: ${color.cmd(suggestion)} ? `);
	console.log(
		`Run ${color.cmd('balena help -v')} for a list of available commands.`,
	);

	const COMMAND_NOT_FOUND = 127;
	process.exit(COMMAND_NOT_FOUND);
};

export default hook;
