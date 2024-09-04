/**
 * @license
 * Copyright 2016-2019 Balena Ltd.
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
import { Args } from '@oclif/core';
import Command from '../../command.js';

import * as cf from '../../utils/common-flags.js';
import * as ec from '../../utils/env-common.js';
import { getBalenaSdk, stripIndent } from '../../utils/lazy.js';
import { parseAsInteger } from '../../utils/validation.js';

export default class EnvRenameCmd extends Command {
	public static description = stripIndent`
		Change the value of a config or env var for a fleet, device or service.

		Change the value of a configuration or environment variable for a fleet,
		device or service, as selected by command-line options.

		${ec.rmRenameHelp.split('\n').join('\n\t\t')}
`;
	public static examples = [
		'$ balena env rename 123123 emacs',
		'$ balena env rename 234234 emacs --service',
		'$ balena env rename 345345 emacs --device',
		'$ balena env rename 456456 emacs --device --service',
		'$ balena env rename 567567 1 --config',
		'$ balena env rename 678678 1 --device --config',
	];

	public static args = {
		id: Args.integer({
			required: true,
			description: "variable's numeric database ID",
			parse: async (input) => parseAsInteger(input, 'id'),
		}),
		value: Args.string({
			required: true,
			description:
				"variable value; if omitted, use value from this process' environment",
		}),
	};

	public static usage = 'env rename <id> <value>';

	public static flags = {
		config: ec.booleanConfig,
		device: ec.booleanDevice,
		service: ec.booleanService,
		help: cf.help,
	};

	public async run() {
		const { args: params, flags: opt } = await this.parse(EnvRenameCmd);

		await Command.checkLoggedIn();

		await getBalenaSdk().pine.patch({
			resource: ec.getVarResourceName(opt.config, opt.device, opt.service),
			id: params.id,
			body: {
				value: params.value,
			},
		});
	}
}
