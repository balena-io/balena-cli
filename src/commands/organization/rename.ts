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
import { getBalenaSdk, stripIndent, getCliForm } from '../../utils/lazy';

export default class OrganizationRenameCmd extends Command {
	public static description = stripIndent`
		Rename an organization.

		Rename an organization.

		Note, if the name is omitted, it will be prompted for interactively.
		`;
	public static examples = [
		'$ balena organization rename my_org_handle',
		'$ balena organization rename my_org_handle "My New Org"',
	];

	public static args = {
		handle: Args.string({
			description: 'the handle of the organization to rename',
			required: true,
		}),
		newName: Args.string({
			description: 'the new name for the organization',
		}),
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = await this.parse(OrganizationRenameCmd);

		const balena = getBalenaSdk();

		const newName =
			// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
			params.newName ||
			(await getCliForm().ask({
				message: 'How do you want to name this organization?',
				type: 'input',
				// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
			})) ||
			'';

		const org = await balena.models.organization.get(params.handle, {
			$select: 'id',
		});
		await balena.pine.patch({
			resource: 'organization',
			id: org.id,
			body: {
				name: newName,
			},
		});
	}
}
