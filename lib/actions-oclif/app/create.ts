/**
 * @license
 * Copyright 2016-2020 Balena Ltd.
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

import { flags } from '@oclif/command';
import { stripIndent } from 'common-tags';
import Command from '../../command';
import { ExpectedError } from '../../errors';
import * as cf from '../../utils/common-flags';
import { getBalenaSdk } from '../../utils/lazy';

interface FlagsDef {
	type?: string; // application device type
	help: void;
}

interface ArgsDef {
	name: string;
}

export default class AppCreateCmd extends Command {
	public static description = stripIndent`
		Create an application.

		Create a new balena application.

		You can specify the application device type with the \`--type\` option.
		Otherwise, an interactive dropdown will be shown for you to select from.

		You can see a list of supported device types with:

		$ balena devices supported
`;
	public static examples = [
		'$ balena app create MyApp',
		'$ balena app create MyApp --type raspberry-pi',
	];

	public static args = [
		{
			name: 'name',
			description: 'application name',
			required: true,
		},
	];

	public static usage = 'app create <name>';

	public static flags: flags.Input<FlagsDef> = {
		type: flags.string({
			char: 't',
			description:
				'application device type (Check available types with `balena devices supported`)',
		}),
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			AppCreateCmd,
		);

		const balena = getBalenaSdk();
		const patterns = await import('../../utils/patterns');

		// First make sure they don't already have an app with this name
		if (await balena.models.application.has(params.name)) {
			throw new ExpectedError(
				'You already have an application with that name!',
			);
		}

		// Create application
		const deviceType = options.type || (await patterns.selectDeviceType());
		const application = await balena.models.application.create({
			name: params.name,
			deviceType,
		});

		console.info(
			`Application created: ${application.app_name} (${application.device_type}, id ${application.id})`,
		);
	}
}
