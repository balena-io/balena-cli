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

import { Args, Command } from '@oclif/core';
import * as cf from '../../utils/common-flags';
import { getBalenaSdk, stripIndent } from '../../utils/lazy';

export default class OrganizationRmCmd extends Command {
	public static description = stripIndent`
		Remove an organizations.

		Remove an organizations from balena.

		Note this command asks for confirmation interactively.
		You can avoid this by passing the \`--yes\` option.
		`;
	public static examples = [
		'$ balena organization rm my_org_handle',
		'$ balena organization rm my_org_handle --yes',
	];

	public static args = {
		handle: Args.string({
			description: 'the handle of the organization to delete',
			required: true,
		}),
	};

	public static flags = {
		yes: cf.yes(),
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } =
			await this.parse(OrganizationRmCmd);

		const balena = getBalenaSdk();
		const patterns = await import('../../utils/patterns');

		// Confirm
		const org = await balena.models.organization.get(params.handle, {
			$select: ['id', 'name'],
		});

		await patterns.confirm(
			options.yes,
			`Are you sure you want to delete organization '${org.name}' with handle '${params.handle}' ?`,
		);

		await balena.models.organization.remove(org.id);
	}
}
