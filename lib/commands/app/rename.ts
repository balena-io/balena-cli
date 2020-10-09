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
import type { IArg } from '@oclif/parser/lib/args';
import Command from '../../command';
import * as cf from '../../utils/common-flags';
import { getBalenaSdk, stripIndent, getCliForm } from '../../utils/lazy';
import type { Application, ApplicationType, BalenaSDK } from 'balena-sdk';

interface FlagsDef {
	help: void;
}

interface ArgsDef {
	name: string;
	newName?: string;
}

export default class AppRenameCmd extends Command {
	public static description = stripIndent`
		Rename an application.

		Rename an application.

		Note, if the \`newName\` parameter is omitted, it will be
		prompted for interactively.
		`;
	public static examples = [
		'$ balena app rename OldName',
		'$ balena app rename OldName NewName',
	];

	public static args: Array<IArg<any>> = [
		{
			name: 'name',
			description: 'application name or numeric ID',
			required: true,
		},
		{
			name: 'newName',
			description: 'the new name for the application',
		},
	];

	public static flags: flags.Input<FlagsDef> = {
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = this.parse<FlagsDef, ArgsDef>(AppRenameCmd);

		const { ExpectedError, instanceOf } = await import('../../errors');
		const balena = getBalenaSdk();

		// Get app
		let app;
		try {
			app = await balena.models.application.get(params.name, {
				$expand: {
					application_type: {
						$select: ['is_legacy'],
					},
				},
			});
		} catch (e) {
			const { BalenaApplicationNotFound } = await import('balena-errors');
			if (instanceOf(e, BalenaApplicationNotFound)) {
				throw new ExpectedError(`Application ${params.name} not found.`);
			} else {
				throw e;
			}
		}

		// Check app supports renaming
		const appType = (app.application_type as ApplicationType[])?.[0];
		if (appType.is_legacy) {
			throw new ExpectedError(
				`Application ${params.name} is of 'legacy' type, and cannot be renamed.`,
			);
		}

		const { validateApplicationName } = await import('../../utils/validation');
		const newName =
			params.newName ||
			(await getCliForm().ask({
				message: 'Please enter the new name for this application:',
				type: 'input',
				validate: validateApplicationName,
			})) ||
			'';

		try {
			await this.renameApplication(balena, app.id, newName);
		} catch (e) {
			// BalenaRequestError: Request error: Unique key constraint violated
			if ((e.message || '').toLowerCase().includes('unique')) {
				throw new ExpectedError(
					`Error: application ${params.name} already exists.`,
				);
			}
			throw e;
		}

		console.log(`Application ${params.name} renamed to ${newName}`);
	}

	async renameApplication(balena: BalenaSDK, id: number, newName: string) {
		return balena.pine.patch<Application>({
			resource: 'application',
			id,
			body: {
				app_name: newName,
			},
		});
	}
}
