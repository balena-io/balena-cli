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

import { Command, flags } from '@oclif/command';
import { stripIndent } from 'common-tags';

import { CommandHelp } from '../../utils/oclif-utils';

interface FlagsDef {
	device: boolean;
	yes: boolean;
}

interface ArgsDef {
	id: number;
}

export default class EnvRmCmd extends Command {
	public static description = stripIndent`
		Remove an environment variable from an application or device.

		Remove an environment variable from an application or device, as selected
		by command-line options.

		Note that this command asks for confirmation interactively.
		You can avoid this by passing the \`--yes\` boolean option.

		The --device option selects a device instead of an application.

		Service-specific variables are not currently supported. The following
		examples remove variables that apply to all services in an app or device.
`;
	public static examples = [
		'$ balena env rm 215',
		'$ balena env rm 215 --yes',
		'$ balena env rm 215 --device',
	];

	public static args = [
		{
			name: 'id',
			required: true,
			description: 'environment variable id',
		},
	];

	// hardcoded 'env add' to avoid oclif's 'env:add' topic syntax
	public static usage =
		'env rm ' + new CommandHelp({ args: EnvRmCmd.args }).defaultUsage();

	public static flags: flags.Input<FlagsDef> = {
		device: flags.boolean({
			char: 'd',
			description:
				'Selects a device environment variable instead of an application environment variable',
			default: false,
		}),
		yes: flags.boolean({
			char: 'y',
			description: 'Run in non-interactive mode',
			default: false,
		}),
	};

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			EnvRmCmd,
		);
		const balena = (await import('balena-sdk')).fromSharedOptions();
		const patterns = await import('../../utils/patterns');

		if (isNaN(params.id) || !Number.isInteger(Number(params.id))) {
			patterns.exitWithExpectedError(
				'The environment variable id must be an integer',
			);
		}

		return patterns
			.confirm(
				options.yes || false,
				'Are you sure you want to delete the environment variable?',
			)
			.then(function() {
				if (options.device) {
					return balena.pine.delete({
						resource: 'device_environment_variable',
						id: params.id,
					});
				} else {
					return balena.pine.delete({
						resource: 'application_environment_variable',
						id: params.id,
					});
				}
			});
	}
}
