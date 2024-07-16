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

import { Args } from '@oclif/core';

import Command from '../../command.js';
import * as cf from '../../utils/common-flags.js';
import * as ca from '../../utils/common-args.js';
import { getBalenaSdk, stripIndent, getCliForm } from '../../utils/lazy.js';
import { applicationIdInfo } from '../../utils/messages.js';

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

	public static args = {
		fleet: ca.fleetRequired,
		newName: Args.string({
			description: 'the new name for the fleet',
		}),
	};

	public static usage = 'fleet rename <fleet> [newName]';

	public static flags = {
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = await this.parse(FleetRenameCmd);

		const { validateApplicationName } = await import(
			'../../utils/validation.js'
		);
		const { ExpectedError } = await import('../../errors.js');

		const balena = getBalenaSdk();

		// Disambiguate target application (if params.params is a number, it could either be an ID or a numerical name)
		const { getApplication } = await import('../../utils/sdk.js');
		const application = await getApplication(balena, params.fleet, {
			$select: ['id', 'app_name', 'slug'],
			$expand: {
				application_type: {
					$select: 'slug',
				},
			},
		});

		// Check app exists
		if (!application) {
			throw new ExpectedError(`Error: fleet ${params.fleet} not found.`);
		}

		// Check app supports renaming
		const appType = application.application_type[0];
		if (appType.slug === 'legacy-v1' || appType.slug === 'legacy-v2') {
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
		const renamedApplication = await getApplication(balena, application.id, {
			$select: ['app_name', 'slug'],
		});

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
