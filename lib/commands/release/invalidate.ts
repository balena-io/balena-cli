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

import { commitOrIdArg } from './index.js';
import Command from '../../command.js';
import * as cf from '../../utils/common-flags.js';
import { getBalenaSdk, stripIndent } from '../../utils/lazy.js';

export default class ReleaseInvalidateCmd extends Command {
	public static description = stripIndent`
		Invalidate a release.

		Invalidate a release.

		Invalid releases are not automatically deployed to devices tracking the latest
		release. For an invalid release to be deployed to a device, the device should be
		explicity pinned to that release.
`;
	public static examples = [
		'$ balena release invalidate a777f7345fe3d655c1c981aa642e5555',
		'$ balena release invalidate 1234567',
	];

	public static usage = 'release invalidate <commitOrId>';

	public static flags = {
		help: cf.help,
	};

	public static args = {
		commitOrId: commitOrIdArg({
			description: 'the commit or ID of the release to invalidate',
			required: true,
		}),
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = await this.parse(ReleaseInvalidateCmd);

		const balena = getBalenaSdk();

		const release = await balena.models.release.get(params.commitOrId, {
			$select: ['id', 'is_invalidated'],
		});

		if (release.is_invalidated) {
			console.log(`Release ${params.commitOrId} is already invalidated!`);
			return;
		}

		await balena.models.release.setIsInvalidated(release.id, true);
		console.log(`Release ${params.commitOrId} invalidated`);
	}
}
