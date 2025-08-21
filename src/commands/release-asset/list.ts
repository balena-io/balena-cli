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

import { Command } from '@oclif/core';
import { getBalenaSdk, getVisuals, stripIndent } from '../../utils/lazy';
import { commitOrIdArg } from '../release';
import * as cf from '../../utils/common-flags';
import { jsonInfo } from '../../utils/messages';

export default class ReleaseAssetListCmd extends Command {
	public static description = stripIndent`
		List all release assets.

		List all assets for a specific release.
		${jsonInfo.split('\n').join('\n\t\t')}
	`;

	public static examples = [
		'$ balena release-asset list 1234567',
		'$ balena release-asset list a777f7345fe3d655c1c981aa642e5555',
		'$ balena release-asset list 1234567 --json',
	];

	public static args = {
		commitOrId: commitOrIdArg({
			description: 'the commit or ID of the release',
			required: true,
		}),
	};

	public static flags = {
		json: cf.json,
	};

	public static authenticated = true;

	public async run() {
		const { args, flags } = await this.parse(ReleaseAssetListCmd);
		const balena = getBalenaSdk();

		const releaseAssets = await balena.models.release.asset.getAllByRelease(
			args.commitOrId,
			{
				$select: ['id', 'asset_key', 'asset'],
			},
		);

		if (flags.json) {
			console.log(JSON.stringify(releaseAssets, null, 2));
		} else {
			if (releaseAssets == null || releaseAssets.length === 0) {
				console.log('No assets found for this release');
				return;
			}

			const tableData = releaseAssets.map((releaseAsset) => {
				let sizeStr = '-';
				if (releaseAsset.asset?.size) {
					const size = releaseAsset.asset.size;
					if (size < 1000) {
						sizeStr = `${size} B`;
					} else if (size < 1000 * 1000) {
						sizeStr = `${(size / 1000).toFixed(2)} KB`;
					} else if (size < 1000 * 1000 * 1000) {
						sizeStr = `${(size / 1000 / 1000).toFixed(2)} MB`;
					} else {
						sizeStr = `${(size / 1000 / 1000 / 1000).toFixed(2)} GB`;
					}
				}

				return {
					'Asset Key': releaseAsset.asset_key,
					'Release Asset ID': releaseAsset.id,
					Filename: releaseAsset.asset?.filename ?? '-',
					Size: sizeStr,
					Type: releaseAsset.asset?.content_type ?? '-',
				};
			});

			console.log(
				getVisuals().table.horizontal(tableData, [
					'Asset Key',
					'Release Asset ID',
					'Filename',
					'Size',
					'Type',
				]),
			);
		}
	}
}
