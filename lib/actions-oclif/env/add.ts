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
import * as _ from 'lodash';

import { ExpectedError } from '../../errors';
import * as cf from '../../utils/common-flags';
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
		Add an environment or config variable to an application or device.

		Add an environment or config variable to an application or device, as selected
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
				"variable value; if omitted, use value from CLI's environment",
		},
	];

	// hardcoded 'env add' to avoid oclif's 'env:add' topic syntax
	public static usage =
		'env add ' + new CommandHelp({ args: EnvAddCmd.args }).defaultUsage();

	public static flags: flags.Input<FlagsDef> = {
		application: _.assign({ exclusive: ['device'] }, cf.application),
		device: _.assign({ exclusive: ['application'] }, cf.device),
		help: cf.help,
		quiet: cf.quiet,
	};

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			EnvAddCmd,
		);
		const cmd = this;
		const balena = (await import('balena-sdk')).fromSharedOptions();
		const { checkLoggedIn } = await import('../../utils/patterns');

		await checkLoggedIn();

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
		const varType = isConfigVar ? 'configVar' : 'envVar';

		if (options.application) {
			await balena.models.application[varType].set(
				options.application,
				params.name,
				params.value,
			);
		} else if (options.device) {
			await balena.models.device[varType].set(
				options.device,
				params.name,
				params.value,
			);
		} else {
			throw new ExpectedError('You must specify an application or device');
		}
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
