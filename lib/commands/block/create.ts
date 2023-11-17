/**
 * @license
 * Copyright 2016-2021 Balena Ltd.
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

import { Flags, Args } from '@oclif/core';

import Command from '../../command.js';
import * as cf from '../../utils/common-flags.js';
import { stripIndent } from '../../utils/lazy.js';

export default class BlockCreateCmd extends Command {
	public static description = stripIndent`
		Create an block.

		Create a new balena block.

		You can specify the organization the block should belong to using
		the \`--organization\` option. The organization's handle, not its name,
		should be provided. Organization handles can be listed with the
		\`balena orgs\` command.

		The block's default device type is specified with the \`--type\` option.
		The \`balena devices supported\` command can be used to list the available
		device types.

		Interactive dropdowns will be shown for selection if no device type or
		organization is specified and there are multiple options to choose from.
		If there is a single option to choose from, it will be chosen automatically.
		This interactive behavior can be disabled by explicitly specifying a device
		type and organization.
	`;

	public static examples = [
		'$ balena block create MyBlock',
		'$ balena block create MyBlock --organization mmyorg',
		'$ balena block create MyBlock -o myorg --type raspberry-pi',
	];

	public static args = {
		name: Args.string({
			description: 'block name',
			required: true,
		}),
	};

	public static usage = 'block create <name>';

	public static flags = {
		organization: Flags.string({
			char: 'o',
			description: 'handle of the organization the block should belong to',
		}),
		type: Flags.string({
			char: 't',
			description:
				'block device type (Check available types with `balena devices supported`)',
		}),
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(BlockCreateCmd);

		await (
			await import('../../utils/application-create.js')
		).applicationCreateBase('block', options, params);
	}
}
