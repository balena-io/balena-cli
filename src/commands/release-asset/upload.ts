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

import { Command, Flags, Args } from '@oclif/core';
import { getBalenaSdk, stripIndent, getVisuals } from '../../utils/lazy';
import { commitOrIdArg } from '../release';
import * as fs from 'fs/promises';
import * as path from 'path';

export default class ReleaseAssetUploadCmd extends Command {
	public static description = stripIndent`
		Upload a release asset.

		Upload a file as a release asset with the specified key. If the asset already exists,
		you can use the --overwrite flag to replace it. You can customize the upload behavior with
		--chunk-size and --parallel-chunks options for larger files.
	`;

	public static examples = [
		'$ balena release-asset upload 1234567 ./path/to/config.json --key config.json',
		'$ balena release-asset upload a777f7345fe3d655c1c981aa642e5555 ./app.tar.gz --key app.tar.gz --overwrite',
		'$ balena release-asset upload 1234567 ./file.bin --key large-file.bin --chunk-size 10485760 --parallel-chunks 10',
	];

	public static args = {
		commitOrId: commitOrIdArg({
			description: 'the commit or ID of the release',
			required: true,
		}),
		filePath: Args.string({
			description: 'path to the file to upload',
			required: true,
		}),
	};

	public static flags = {
		key: Flags.string({
			description: 'the key for the release asset',
			required: true,
		}),
		overwrite: Flags.boolean({
			description: 'overwrite the asset if it already exists',
			default: false,
		}),
		'chunk-size': Flags.integer({
			description: 'chunk size in bytes for multipart upload (minimum 5MB)',
			default: 5 * 1024 * 1024, // 5MiB default
		}),
		'parallel-chunks': Flags.integer({
			description: 'number of chunks to upload in parallel',
			default: 5,
		}),
	};

	public static authenticated = true;

	public async run() {
		const { args, flags } = await this.parse(ReleaseAssetUploadCmd);
		const balena = getBalenaSdk();

		try {
			await fs.access(args.filePath);
		} catch (error) {
			console.error(error);
			throw new Error(`File not found: ${args.filePath}`);
		}

		const { getRelease } = await import('../../utils/sdk');
		const release = await getRelease(args.commitOrId, {
			$select: ['id'],
		});

		const absolutePath = path.resolve(args.filePath);

		const visuals = getVisuals();
		const bar = new visuals.Progress(`Uploading release asset '${flags.key}'`);

		const releaseAsset = await balena.models.release.asset.upload(
			{
				release: release.id,
				asset_key: flags.key,
				asset: absolutePath,
			},
			{
				chunkSize: flags['chunk-size'],
				parallelUploads: flags['parallel-chunks'],
				overwrite: flags.overwrite,
				onUploadProgress: (progress) => {
					if (progress.total > 0) {
						const percentage = (progress.uploaded / progress.total) * 100;
						bar.update({ percentage, eta: null });
					}
				},
			},
		);

		console.log(`Release asset '${flags.key}' uploaded successfully`);
		console.log(`Release Asset ID: ${releaseAsset.id}`);
	}
}
