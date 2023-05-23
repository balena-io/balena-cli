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

import { flags } from '@oclif/command';

import Command from '../../command';
import { ExpectedError } from '../../errors';
import * as cf from '../../utils/common-flags';
import { getBalenaSdk, stripIndent } from '../../utils/lazy';

interface FlagsDef {
	organization?: string;
	type?: string; // application device type
	help: void;
}

interface ArgsDef {
	name: string;
}

export default class FleetCreateCmd extends Command {
	public static description = stripIndent`
		Create a fleet.

		Create a new balena fleet.

		You can specify the organization the fleet should belong to using
		the \`--organization\` option. The organization's handle, not its name,
		should be provided. Organization handles can be listed with the
		\`balena orgs\` command.

		The fleet's default device type is specified with the \`--type\` option.
		The \`balena devices supported\` command can be used to list the available
		device types.

		Interactive dropdowns will be shown for selection if no device type or
		organization is specified and there are multiple options to choose from.
		If there is a single option to choose from, it will be chosen automatically.
		This interactive behavior can be disabled by explicitly specifying a device
		type and organization.
	`;

	public static examples = [
		'$ balena fleet create MyFleet',
		'$ balena fleet create MyFleet --organization mmyorg',
		'$ balena fleet create MyFleet -o myorg --type raspberry-pi',
	];

	public static args = [
		{
			name: 'name',
			description: 'fleet name',
			required: true,
		},
	];

	public static usage = 'fleet create <name>';

	public static flags: flags.Input<FlagsDef> = {
		organization: flags.string({
			char: 'o',
			description: 'handle of the organization the fleet should belong to',
		}),
		type: flags.string({
			char: 't',
			description:
				'fleet device type (Check available types with `balena devices supported`)',
		}),
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			FleetCreateCmd,
		);

		// Ascertain device type
		const deviceType =
			options.type ||
			(await (await import('../../utils/patterns')).selectDeviceType());

		// Ascertain organization
		const organization =
			options.organization?.toLowerCase() || (await this.getOrganization());

		// Create application
		try {
			const application = await getBalenaSdk().models.application.create({
				name: params.name,
				deviceType,
				organization,
			});

			// Output
			console.log(
				`Fleet created: slug "${application.slug}", device type "${deviceType}"`,
			);
		} catch (err) {
			if ((err.message || '').toLowerCase().includes('unique')) {
				// BalenaRequestError: Request error: "organization" and "app_name" must be unique.
				throw new ExpectedError(
					`Error: fleet "${params.name}" already exists in organization "${organization}".`,
				);
			} else if ((err.message || '').toLowerCase().includes('unauthorized')) {
				// BalenaRequestError: Request error: Unauthorized
				throw new ExpectedError(
					`Error: You are not authorized to create fleets in organization "${organization}".`,
				);
			}

			throw err;
		}
	}

	async getOrganization() {
		const { getOwnOrganizations } = await import('../../utils/sdk');
		const organizations = await getOwnOrganizations(getBalenaSdk());

		if (organizations.length === 0) {
			// User is not a member of any organizations (should not happen).
			throw new Error('This account is not a member of any organizations');
		} else if (organizations.length === 1) {
			// User is a member of only one organization - use this.
			return organizations[0].handle;
		} else {
			// User is a member of multiple organizations -
			const { selectOrganization } = await import('../../utils/patterns');
			return selectOrganization(organizations);
		}
	}
}
