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

import type { flags } from '@oclif/command';
import type { ApplicationType } from 'balena-sdk';

import Command from '../../command';
import * as cf from '../../utils/common-flags';
import * as ca from '../../utils/common-args';
import { getBalenaSdk, stripIndent, getCliForm } from '../../utils/lazy';
import { applicationIdInfo } from '../../utils/messages';

interface FlagsDef {
	help: void;
}

interface ArgsDef {
	fleet: string;
	newName?: string;
}

export default class FleetRenameCmd extends Command {
	public static description = stripIndent`
		Rename a fleet.

		Rename a fleet.

		Note, if the \`newName\` parameter is omitted, it will be
		prompted for interactively.

		${applicationIdInfo.split('\n').join('\n\t\t')}
	`;

	public static examples = [
		'$ balena fleet rename OldName',
		'$ balena fleet rename OldName NewName',
		'$ balena fleet rename myorg/oldname NewName',
	];

	public static args = [
		ca.fleetRequired,
		{
			name: 'newName',
			description: 'the new name for the fleet',
		},
	];

	public static usage = 'fleet rename <fleet> [newName]';

	public static flags: flags.Input<FlagsDef> = {
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = this.parse<FlagsDef, ArgsDef>(FleetRenameCmd);

		const { validateApplicationName } = await import('../../utils/validation');
		const { ExpectedError } = await import('../../errors');

		const balena = getBalenaSdk();

		// Disambiguate target application (if params.params is a number, it could either be an ID or a numerical name)
		const { getApplication } = await import('../../utils/sdk');
		const application = await getApplication(balena, params.fleet, {
			$expand: {
				application_type: {
					$select: ['is_legacy'],
				},
			},
		});

		// Check app exists
		if (!application) {
			throw new ExpectedError(`Error: fleet ${params.fleet} not found.`);
		}

		// Check app supports renaming
		const appType = (application.application_type as ApplicationType[])?.[0];
		if (appType.is_legacy) {
			throw new ExpectedError(
				`Fleet ${params.fleet} is of 'legacy' type, and cannot be renamed.`,
			);
		}

		// Ascertain new name
		const newName =
			params.newName ||
			(await getCliForm().ask({
				message: 'Please enter the new name for this fleet:',
				type: 'input',
				validate: validateApplicationName,
			})) ||
			'';

		// Check they haven't used slug in new name
		if (newName.includes('/')) {
			throw new ExpectedError(
				`New fleet name cannot include '/', please check that you are not specifying fleet slug.`,
			);
		}

		// Rename
		try {
			await balena.models.application.rename(application.id, newName);
		} catch (e) {
			// BalenaRequestError: Request error: "organization" and "app_name" must be unique.
			if ((e.message || '').toLowerCase().includes('unique')) {
				throw new ExpectedError(`Error: fleet ${newName} already exists.`);
			}
			// BalenaRequestError: Request error: App name may only contain [a-zA-Z0-9_-].
			if ((e.message || '').toLowerCase().includes('name may only contain')) {
				throw new ExpectedError(
					`Error: new fleet name may only include characters [a-zA-Z0-9_-].`,
				);
			}
			throw e;
		}

		// Get application again, to be sure of results
		const renamedApplication = await balena.models.application.get(
			application.id,
		);

		// Output result
		console.log(`Fleet renamed`);
		console.log('From:');
		console.log(`\tname: ${application.app_name}`);
		console.log(`\tslug: ${application.slug}`);
		console.log('To:');
		console.log(`\tname: ${renamedApplication.app_name}`);
		console.log(`\tslug: ${renamedApplication.slug}`);
	}
}
