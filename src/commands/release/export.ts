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
import { create } from '@balena/release-bundle';
import * as fs from 'fs/promises';
import * as semver from 'balena-semver';
import { ExpectedError } from '../../errors';

export default class ReleaseExportCmd extends Command {
	public static description = stripIndent`
		Exports a release into a file.

		Exports a release to a file that you can use to import an exact 
		copy of the original release into another app.

		If the SemVer of a release is provided using the --version option,
		the first argument is assumed to be the fleet's slug.

		Only successful releases can be exported.
`;
	public static examples = [
		'$ balena release export a777f7345fe3d655c1c981aa642e5555 -o ../path/to/release.tar',
		'$ balena release export myOrg/myFleet --version 1.2.3 -o ../path/to/release.tar',
		'$ balena release export myFleet --version 1.2.3 -o ../path/to/release.tar',
	];

	public static usage = 'release export <commitOrFleet>';

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
		commitOrFleet: Args.string({
			description:
				'release commit or fleet if used in conjunction with the --version option',
			required: true,
		}),
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(ReleaseExportCmd);

		const balena = getBalenaSdk();

		let versionInfo = '';
		try {
			let releaseDetails:
				| string
				| number
				| { application: string | number; rawVersion: string }; // ReleaseRawVersionApplicationPair
			if (options.version != null) {
				versionInfo = ` version ${options.version}`;
				const parsedVersion = semver.parse(options.version);
				if (parsedVersion == null) {
					throw new ExpectedError(`version must be valid SemVer`);
				} else {
					const { getApplication } = await import('../../utils/sdk');
					const application = (
						await getApplication(balena, params.commitOrFleet)
					).id;
					releaseDetails = { application, rawVersion: parsedVersion.raw };
				}
			} else {
				releaseDetails = params.commitOrFleet;
			}

			const release = await balena.models.release.get(releaseDetails, {
				$select: ['id'],
			});
			const releaseBundle = await create({
				sdk: balena,
				releaseId: release.id,
			});
			await fs.writeFile(options.output, releaseBundle);
			console.log(
				`Release ${params.commitOrFleet}${versionInfo} has been exported to ${options.output}.`,
			);
		} catch (error) {
			throw new ExpectedError(
				`Release ${params.commitOrFleet}${versionInfo} could not be exported: ${error.message}`,
			);
		}
	}
}
