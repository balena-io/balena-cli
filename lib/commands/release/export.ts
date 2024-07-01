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

export default class ReleaseExportCmd extends Command {
	public static description = stripIndent`
		Exports a release to a release bundle file.

        Exports a successful release to a release bundle file that can be used
        to import the release to another application or fleet.
`;
	public static examples = [
		'$ balena release export a777f7345fe3d655c1c981aa642e5555 -o ../path/to/release.tar',
		'$ balena release export 1234567 -o ../path/to/release.tar',
	];

	public static usage = 'release export <commitOrId>';

	public static flags = {
		output: Flags.string({
			description: 'output path',
			char: 'o',
			required: true,
		}),
		help: cf.help,
	};

	public static args = {
		commitOrId: commitOrIdArg({
			description: 'commit or ID of the release to export',
			required: true,
		}),
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(ReleaseExportCmd);

		const balena = getBalenaSdk();

		const release = await balena.models.release.get(params.commitOrId, {
			$select: ['id'],
		});

		try {
			const releaseBundle = await create({
				sdk: balena,
				releaseId: release.id,
			});
			await fs.writeFile(options.output, releaseBundle);
		} catch (error) {
			console.log(
				`Release ${params.commitOrId} could not be exported. ${error.message}`,
			);
		}

		console.log(
			`Release ${params.commitOrId} has been exported to ${options.output}.`,
		);
	}
}
