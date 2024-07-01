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

import { commitOrIdArg } from '.';
import { Flags } from '@oclif/core';
import Command from '../../command';
import * as cf from '../../utils/common-flags';
import { getBalenaSdk, stripIndent } from '../../utils/lazy';
import { create } from '@balena/release-bundle';
import * as fs from 'fs/promises';
import * as semver from 'balena-semver';
import { ExpectedError } from '../../errors';

export default class ReleaseExportCmd extends Command {
	public static description = stripIndent`
		Exports a release into a file.

        Exporting a release to a file allows you to import an exact 
		copy of the original release into another app.

		If the SemVer of a release is provided using the --version option,
		the first argument is assumed to be the fleet's slug.

		Only successful releases can be exported.
`;
	public static examples = [
		'$ balena release export a777f7345fe3d655c1c981aa642e5555 -o ../path/to/release.tar',
		'$ balena release export myOrg/myFleet --version 1.2.3 -o ../path/to/release.tar',
	];

	public static usage = 'release export <commitOrId>';

	public static flags = {
		output: Flags.string({
			description: 'output path',
			char: 'o',
			required: true,
		}),
		version: Flags.string({
			description: 'version of the release to export from the specified fleet',
		}),
		help: cf.help,
	};

	public static args = {
		commitOrId: commitOrIdArg({
			description: 'commit, ID, or version of the release to export',
			required: true,
		}),
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(ReleaseExportCmd);

		const balena = getBalenaSdk();

		let release: balenaSdk.Release;
		if (typeof options.version === 'string') {
			const application = params.commitOrId;
			const parsedVersion = semver.parse(options.version);
			if (parsedVersion == null) {
				throw new ExpectedError(
					`Release of ${application} with version ${options.version} could not be exported; version must be valid SemVer.`,
				);
			} else {
				const rawVersion =
					parsedVersion.build.length === 0
						? parsedVersion.version
						: `${parsedVersion.version}+${parsedVersion.build[0]}`;
				release = await balena.models.release.get(
					{ application, rawVersion },
					{ $select: ['id'] },
				);
			}
		} else {
			release = await balena.models.release.get(params.commitOrId, {
				$select: ['id'],
			});
		}

		try {
			const releaseBundle = await create({
				sdk: balena,
				releaseId: release.id,
			});
			await fs.writeFile(options.output, releaseBundle);
			const versionInfo =
				typeof options.version === 'string'
					? ` version ${options.version}`
					: '';
			console.log(
				`Release ${params.commitOrId}${versionInfo} has been exported to ${options.output}.`,
			);
		} catch (error) {
			throw new ExpectedError(
				`Release ${params.commitOrId} could not be exported: ${error.message}`,
			);
		}
	}
}
