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
import { getBalenaSdk, stripIndent, getVisuals } from '../../utils/lazy';
import { commitOrIdArg } from '../release';
import * as fs from 'fs';
import * as path from 'path';
import { pipeline } from 'stream/promises';
import { Transform } from 'stream';

export default class ReleaseAssetDownloadCmd extends Command {
	public static description = stripIndent`
		Download a release asset.

		Download a release asset with the specified key. By default, the file will be saved
		with the original filename. Use the --output flag to specify a different output path.
		
		If the output file already exists, the command will prompt for confirmation before
		overwriting, unless the --overwrite flag is specified.
	`;

	public static examples = [
		'$ balena release-asset download 1234567 --key config.json',
		'$ balena release-asset download a777f7345fe3d655c1c981aa642e5555 --key app.tar.gz --output ./downloads/app.tar.gz',
		'$ balena release-asset download 1234567 --key large-file.bin -o output.bin',
		'$ balena release-asset download 1234567 --key config.json --overwrite',
	];

	public static args = {
		commitOrId: commitOrIdArg({
			description: 'the commit or ID of the release',
			required: true,
		}),
	};

	public static flags = {
		key: Flags.string({
			description: 'the key of the release asset to download',
			required: true,
		}),
		output: Flags.string({
			char: 'o',
			description: 'output path for the downloaded file',
		}),
		overwrite: Flags.boolean({
			description: 'overwrite existing file without confirmation',
			default: false,
		}),
	};

	public static authenticated = true;

	public async run() {
		const { args, flags } = await this.parse(ReleaseAssetDownloadCmd);
		const balena = getBalenaSdk();

		const release = await balena.models.release.get(args.commitOrId, {
			$select: ['id'],
		});

		const releaseAsset = await balena.models.release.asset.get(
			{
				release: release.id,
				asset_key: flags.key,
			},
			{
				$select: ['id', 'asset'],
			},
		);

		if (releaseAsset.asset == null) {
			throw new Error(`Release asset ${releaseAsset.id} is empty`);
		}

		const stream = await balena.models.release.asset.download({
			release: release.id,
			asset_key: flags.key,
		});

		let outputPath: string;
		if (flags.output) {
			outputPath = path.resolve(flags.output);
		} else {
			// Use the asset key as the filename since we don't have headers
			outputPath = path.resolve(flags.key);
		}

		if (fs.existsSync(outputPath) && !flags.overwrite) {
			const patterns = await import('../../utils/patterns');
			await patterns.confirm(
				false,
				`File ${outputPath} already exists. Do you want to overwrite it?`,
			);
		}

		const dir = path.dirname(outputPath);
		await fs.promises.mkdir(dir, { recursive: true });

		const visuals = getVisuals();
		const bar = new visuals.Progress(
			`Downloading release asset '${flags.key}'`,
		);

		const totalSize = releaseAsset.asset.size;
		let downloadedBytes = 0;

		const progressStream = new Transform({
			transform(chunk, _encoding, callback) {
				downloadedBytes += chunk.length;

				if (totalSize != null && totalSize > 0) {
					const percentage = (downloadedBytes / totalSize) * 100;
					bar.update({ percentage, eta: null });
				}

				callback(null, chunk);
			},
		});

		const writeStream = fs.createWriteStream(outputPath);
		await pipeline(stream, progressStream, writeStream);

		console.log(
			`Release asset '${flags.key}' downloaded successfully to ${outputPath}`,
		);
	}
}
