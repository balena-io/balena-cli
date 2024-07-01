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

import { Flags, Args } from '@oclif/core';
import Command from '../../command';
import * as cf from '../../utils/common-flags';
import { getBalenaSdk, stripIndent } from '../../utils/lazy';
import { apply } from '@balena/release-bundle';
import { createReadStream } from 'fs';
import { ExpectedError } from '../../errors';

export default class ReleaseImportCmd extends Command {
	public static description = stripIndent`
		Imports a release from a file to an app or fleet. The revision field of the release
		is automatically omitted when importing a release. The backend will auto-increment
		the revision field of the imported release if a release exists with the same semver.
		A release will not be imported if a successful release with the same commit already
		exists.

		To export a release to a file, use 'balena release export'.

		Use the --override-version option to specify the version 
		of the imported release, overriding the one saved in the file.
`;
	public static examples = [
		'$ balena release import ../path/to/release.tar myFleet',
		'$ balena release import ../path/to/release.tar myOrg/myFleet',
		'$ balena release import ../path/to/release.tar myOrg/myFleet --override-version 1.2.3',
	];

	public static usage = 'release import <file> <fleet>';

	public static flags = {
		'override-version': Flags.string({
			description:
				'Imports this release with the specified version overriding the version in the file.',
			required: false,
		}),
		help: cf.help,
	};

	public static args = {
		bundle: Args.string({
			required: true,
			description: 'path to a file, e.g. "./release.tar"',
		}),
		fleet: Args.string({
			required: true,
			description:
				'fleet that the release will be imported to, e.g. "myOrg/myFleet"',
		}),
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(ReleaseImportCmd);

		const balena = getBalenaSdk();

		const bundle = createReadStream(params.bundle).on('error', () => {
			throw new ExpectedError(
				`Release bundle ${params.bundle} does not exist or is not accessible.`,
			);
		});

		try {
			const application = await balena.models.application.get(params.fleet, {
				$select: ['id'],
			});
			if (application == null) {
				throw new ExpectedError(`Fleet ${params.fleet} not found.`);
			}
			await apply({
				sdk: balena,
				application: application.id,
				stream: bundle,
				version: options['override-version'],
			});
			console.log(
				`Release bundle ${params.bundle} has been imported to ${params.fleet}.`,
			);
		} catch (error) {
			throw new ExpectedError(
				`Could not import release bundle ${params.bundle} to fleet ${params.fleet}: ${error.message}`,
			);
		}
	}
}
