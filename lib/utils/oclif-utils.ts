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

import * as Config from '@oclif/config';

export const convertedCommands = {
	'env:add': 'env add',
};

/**
 * This class is a partial copy-and-paste of
 * @oclif/plugin-help/command/CommandHelp, which is used to generate oclif's
 * command help output.
 */
export class CommandHelp {
	constructor(public command: { args: any[] }) {}

	protected arg(arg: Config.Command['args'][0]): string {
		const name = arg.name.toUpperCase();
		if (arg.required) {
			return `${name}`;
		}
		return `[${name}]`;
	}

	public defaultUsage(): string {
		return CommandHelp.compact([
			// this.command.id,
			this.command.args
				.filter(a => !a.hidden)
				.map(a => this.arg(a))
				.join(' '),
		]).join(' ');
	}

	public static compact<T>(array: Array<T | undefined>): T[] {
		return array.filter((a): a is T => !!a);
	}
}
