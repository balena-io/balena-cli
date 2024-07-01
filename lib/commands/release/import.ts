/**
 * @license
 * Copyright 2016-2024 Balena Ltd.
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
import Command from '../../command';
import * as cf from '../../utils/common-flags';
import { getBalenaSdk, stripIndent } from '../../utils/lazy';
import { apply } from '@balena/release-bundle';
import { createReadStream } from 'fs';

export default class ReleaseImportCmd extends Command {
	public static description = stripIndent`
		Imports a release from a release bundle file to an application or fleet.
`;
	public static examples = [
		'$ balena release import ../path/to/release.tar -f 1234567',
		'$ balena release import ../path/to/release.tar -f myFleet',
		'$ balena release import ../path/to/release.tar -f myOrg/myFleet',
	];

	public static usage = 'release import <bundleFile>';

	public static flags = {
		fleet: { ...cf.fleet, exclusive: ['device'] },
		help: cf.help,
	};

	public static args = {
		bundle: Args.string({
			required: true,
			description: 'path to a release bundle file, e.g. "release.tar"',
		}),
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(ReleaseImportCmd);

		const balena = getBalenaSdk();

		const bundle = createReadStream(params.bundle);

		try {
			if (
				typeof options.fleet !== 'number' &&
				typeof options.fleet !== 'string'
			) {
				throw new Error('Fleet must be a number or slug.');
			}

			// TODO: validate if the path to the release bundle exists

			const application = await balena.models.application.get(options.fleet, {
				$select: ['id'],
			});
			await apply({
				sdk: balena,
				application: application.id,
				stream: bundle,
			});
		} catch (error) {
			console.log(
				`Could not apply release bundle to fleet ${options.fleet}. ${error.message}`,
			);
		}

		console.log(
			`Release bundle ${params.bundle} has been applied to ${options.fleet}.`,
		);
	}
}
