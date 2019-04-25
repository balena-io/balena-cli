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
	application?: string;
	device?: string;
	help: void;
	quiet: boolean;
}

interface ArgsDef {
	name: string;
	value?: string;
}

export default class EnvAddCmd extends Command {
	public static description = stripIndent`
		Add an enviroment or config variable to an application or device.

		Add an enviroment or config variable to an application or device, as selected
		by the respective command-line options.

		If VALUE is omitted, the CLI will attempt to use the value of the environment
		variable of same name in the CLI process' environment. In this case, a warning
		message will be printed. Use \`--quiet\` to suppress it.

		Service-specific variables are not currently supported. The given command line
		examples variables that apply to all services in an app or device.
`;
	public static examples = [
		'$ balena env add TERM --application MyApp',
		'$ balena env add EDITOR vim --application MyApp',
		'$ balena env add EDITOR vim --device 7cf02a6',
	];

	public static args = [
		{
			name: 'name',
			required: true,
			description: 'environment or config variable name',
		},
		{
			name: 'value',
			required: false,
			description:
				"variable value; if omitted, use value from CLI's enviroment",
		},
	];

	// hardcoded 'env add' to avoid oclif's 'env:add' topic syntax
	public static usage =
		'env add ' + new CommandHelp({ args: EnvAddCmd.args }).defaultUsage();

	public static flags = {
		application: flags.string({
			char: 'a',
			description: 'application name',
			exclusive: ['device'],
		}),
		device: flags.string({
			char: 'd',
			description: 'device UUID',
			exclusive: ['application'],
		}),
		help: flags.help({ char: 'h' }),
		quiet: flags.boolean({
			char: 'q',
			description: 'suppress warning messages',
			default: false,
		}),
	};

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			EnvAddCmd,
		);
		const Bluebird = await import('bluebird');
		const _ = await import('lodash');
		const balena = (await import('balena-sdk')).fromSharedOptions();
		const { exitWithExpectedError } = await import('../../utils/patterns');

		const cmd = this;

		await Bluebird.try(async function() {
			if (params.value == null) {
				params.value = process.env[params.name];

				if (params.value == null) {
					throw new Error(
						`Environment value not found for variable: ${params.name}`,
					);
				} else if (!options.quiet) {
					cmd.warn(
						`Using ${params.name}=${params.value} from CLI process environment`,
					);
				}
			}

			const reservedPrefixes = await getReservedPrefixes();
			const isConfigVar = _.some(reservedPrefixes, prefix =>
				_.startsWith(params.name, prefix),
			);

			if (options.application) {
				return balena.models.application[
					isConfigVar ? 'configVar' : 'envVar'
				].set(options.application, params.name, params.value);
			} else if (options.device) {
				return balena.models.device[isConfigVar ? 'configVar' : 'envVar'].set(
					options.device,
					params.name,
					params.value,
				);
			} else {
				exitWithExpectedError('You must specify an application or device');
			}
		});
	}
}

async function getReservedPrefixes(): Promise<string[]> {
	const balena = (await import('balena-sdk')).fromSharedOptions();
	const settings = await balena.settings.getAll();

	const response = await balena.request.send({
		baseUrl: settings.apiUrl,
		url: '/config/vars',
	});

	return response.body.reservedNamespaces;
}
