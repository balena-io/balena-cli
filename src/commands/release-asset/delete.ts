/**
 * @license
 * Copyright 2025 Balena Ltd.
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

import { Command, Flags } from '@oclif/core';
import { getBalenaSdk, stripIndent } from '../../utils/lazy.js';
import { commitOrIdArg } from '../release/index.js';

export default class ReleaseAssetDeleteCmd extends Command {
	public static description = stripIndent`
		Delete a release asset.

		Delete a release asset with the specified key. This action cannot be undone.
	`;

	public static examples = [
		'$ balena release-asset delete 1234567 --key config.json',
		'$ balena release-asset delete a777f7345fe3d655c1c981aa642e5555 --key app.tar.gz',
		'$ balena release-asset delete 1234567 --key old-asset --yes',
	];

	public static args = {
		commitOrId: commitOrIdArg({
			description: 'the commit or ID of the release',
			required: true,
		}),
	};

	public static flags = {
		key: Flags.string({
			description: 'the key of the release asset to delete',
			required: true,
		}),
		yes: Flags.boolean({
			char: 'y',
			description: 'skip confirmation prompt',
			default: false,
		}),
	};

	public static authenticated = true;

	public async run() {
		const { args, flags } = await this.parse(ReleaseAssetDeleteCmd);
		const balena = getBalenaSdk();

		const release = await balena.models.release.get(args.commitOrId, {
			$select: ['id'],
		});

		const patterns = await import('../../utils/patterns.js');
		await patterns.confirm(
			flags.yes,
			`Are you sure you want to delete release asset '${flags.key}'?`,
		);

		await balena.models.release.asset.remove({
			release: release.id,
			asset_key: flags.key,
		});

		console.log(`Release asset '${flags.key}' deleted successfully`);
	}
}
