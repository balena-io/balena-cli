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

export default class ReleaseFinalizeCmd extends Command {
	public static description = stripIndent`
		Finalize a release.

		Finalize a release. Releases can be "draft" or "final", and this command
		changes a draft release into a final release. Draft releases can be created
		with the \`--draft\` option of the \`balena build\` or \`balena deploy\`
		commands.

		Draft releases are not automatically deployed to devices tracking the latest
		release. For a draft release to be deployed to a device, the device should be
		explicity pinned to that release. Conversely, final releases may trigger immediate
		deployment to unpinned devices (subject to a device's  polling period) and, for
		this reason, final releases cannot be changed back to draft status.
`;
	public static examples = [
		'$ balena release finalize a777f7345fe3d655c1c981aa642e5555',
		'$ balena release finalize 1234567',
	];

	public static usage = 'release finalize <commitOrId>';

	public static flags = {
		help: cf.help,
	};

	public static args = {
		commitOrId: commitOrIdArg({
			description: 'the commit or ID of the release to finalize',
			required: true,
		}),
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = await this.parse(ReleaseFinalizeCmd);

		const balena = getBalenaSdk();

		const release = await balena.models.release.get(params.commitOrId, {
			$select: ['id', 'is_final'],
		});

		if (release.is_final) {
			console.log(`Release ${params.commitOrId} is already finalized!`);
			return;
		}

		await balena.models.release.finalize(release.id);
		console.log(`Release ${params.commitOrId} finalized`);
	}
}
