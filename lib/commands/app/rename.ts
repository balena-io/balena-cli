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
import Command from '../../command';
import * as cf from '../../utils/common-flags';
import * as ca from '../../utils/common-args';
import { getBalenaSdk, stripIndent, getCliForm } from '../../utils/lazy';
import { applicationIdInfo } from '../../utils/messages';
import type { ApplicationType } from 'balena-sdk';

interface FlagsDef {
	help: void;
}

interface ArgsDef {
	application: string;
	newName?: string;
}

export default class AppRenameCmd extends Command {
	public static description = stripIndent`
		Rename an application.

		Rename an application.

		Note, if the \`newName\` parameter is omitted, it will be
		prompted for interactively.

		${applicationIdInfo.split('\n').join('\n\t\t')}
	`;

	public static examples = [
		'$ balena app rename OldName',
		'$ balena app rename OldName NewName',
		'$ balena app rename myorg/oldname NewName',
	];

	public static args = [
		ca.applicationRequired,
		{
			name: 'newName',
			description: 'the new name for the application',
		},
	];

	public static usage = 'app rename <application> [newName]';

	public static flags: flags.Input<FlagsDef> = {
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = this.parse<FlagsDef, ArgsDef>(AppRenameCmd);

		const { validateApplicationName } = await import('../../utils/validation');
		const { ExpectedError } = await import('../../errors');

		const balena = getBalenaSdk();

		// Disambiguate target application (if params.params is a number, it could either be an ID or a numerical name)
		const { getApplication } = await import('../../utils/sdk');
		const application = await getApplication(balena, params.application, {
			$expand: {
				application_type: {
					$select: ['is_legacy'],
				},
			},
		});

		// Check app exists
		if (!application) {
			throw new ExpectedError(
				'Error: application ${params.nameOrSlug} not found.',
			);
		}

		// Check app supports renaming
		const appType = (application.application_type as ApplicationType[])?.[0];
		if (appType.is_legacy) {
			throw new ExpectedError(
				`Application ${params.application} is of 'legacy' type, and cannot be renamed.`,
			);
		}

		// Ascertain new name
		const newName =
			params.newName ||
			(await getCliForm().ask({
				message: 'Please enter the new name for this application:',
				type: 'input',
				validate: validateApplicationName,
			})) ||
			'';

		// Rename
		try {
			await balena.models.application.rename(application.id, newName);
		} catch (e) {
			// BalenaRequestError: Request error: "organization" and "app_name" must be unique.
			if ((e.message || '').toLowerCase().includes('unique')) {
				throw new ExpectedError(
					`Error: application ${params.application} already exists.`,
				);
			}
			throw e;
		}

		// Get application again, to be sure of results
		const renamedApplication = await balena.models.application.get(
			application.id,
		);

		// Output result
		console.log(`Application renamed`);
		console.log('From:');
		console.log(`\tname: ${application.app_name}`);
		console.log(`\tslug: ${application.slug}`);
		console.log('To:');
		console.log(`\tname: ${renamedApplication.app_name}`);
		console.log(`\tslug: ${renamedApplication.slug}`);
	}
}
