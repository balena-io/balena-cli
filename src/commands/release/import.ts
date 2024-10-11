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
import type { ReadStream } from 'fs';
import { promises as fs } from 'fs';
import { ExpectedError } from '../../errors';

export default class ReleaseImportCmd extends Command {
	public static description = stripIndent`
		Imports a release from a file to an app, block, or fleet.

		Imports a release from a file to an app, block, or fleet. The revision field of the
		release is automatically omitted when importing a release. The balena API will
		auto-increment the revision field of the imported release if a release exists with
		the same semver. A release will not be imported if a successful release with the
		same commit already exists.

		Use the --override-version option to specify the version 
		of the imported release, overriding the one saved in the file.

		To export a release to a file, use 'balena release export'.
`;
	public static examples = [
		'$ balena release import ../path/to/release.tar myApp',
		'$ balena release import ../path/to/release.tar myOrg/myFleet',
		'$ balena release import ../path/to/release.tar myOrg/myFleet --override-version 1.2.3',
	];

	public static usage = 'release import <file> <applicapplication>';

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
		application: Args.string({
			required: true,
			description:
				'app, block, or fleet that the release will be imported to, e.g. "myOrg/myFleet"',
		}),
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(ReleaseImportCmd);

		try {
			const balena = getBalenaSdk();

			let bundle: ReadStream;
			try {
				const fileHandle = await fs.open(params.bundle);
				bundle = fileHandle.createReadStream();
			} catch (error) {
				throw new Error(`${params.bundle} does not exist or is not accessible`);
			}

			const { getApplication } = await import('../../utils/sdk');
			const { id: application } = await getApplication(
				balena,
				params.application,
			);
			if (application == null) {
				throw new ExpectedError(`Fleet ${params.application} not found`);
			}
			await apply({
				sdk: balena,
				application,
				stream: bundle,
				version: options['override-version'],
			});
			console.log(
				`Release bundle ${params.bundle} has been imported to ${params.application}.`,
			);
		} catch (error) {
			throw new ExpectedError(
				`Could not import release bundle ${params.bundle} to ${params.application}: ${error.message}`,
			);
		}
	}
}
