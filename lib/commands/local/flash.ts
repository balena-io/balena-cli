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

import { Args } from '@oclif/core';
import type { BlockDevice } from 'etcher-sdk/build/source-destination';
import Command from '../../command.js';
import { ExpectedError } from '../../errors.js';
import * as cf from '../../utils/common-flags.js';
import { getChalk, getVisuals, stripIndent } from '../../utils/lazy.js';

export default class LocalFlashCmd extends Command {
	public static description = stripIndent`
		Flash an image to a drive.

		Flash a balenaOS image to a drive.
		Image file may be one of: .img|.zip|.gz|.bz2|.xz

		If --drive is not specified, then it will interactively
		show a list of available drives for selection.
	`;

	public static examples = [
		'$ balena local flash path/to/balenaos.img',
		'$ balena local flash path/to/balenaos.img --drive /dev/disk2',
		'$ balena local flash path/to/balenaos.img --drive /dev/disk2 --yes',
	];

	public static args = {
		image: Args.string({
			description: 'path to OS image',
			required: true,
		}),
	};

	public static usage = 'local flash <image>';

	public static flags = {
		drive: cf.drive,
		yes: cf.yes,
		help: cf.help,
	};

	public static offlineCompatible = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(LocalFlashCmd);

		if (process.platform === 'linux') {
			const { promisify } = await import('util');
			const { exec } = await import('child_process');
			const execAsync = promisify(exec);
			let distroVersion = '';
			try {
				const info = await execAsync('cat /proc/version');
				distroVersion = info.stdout.toLowerCase();
			} catch {
				// pass
			}
			if (distroVersion.includes('microsoft')) {
				throw new ExpectedError(stripIndent`
				This command is known not to work on WSL. Please use a CLI release
				for Windows (not WSL), or balenaEtcher.`);
			}
		}

		const drive = await this.getDrive(options);

		const { confirm } = await import('../../utils/patterns.js');
		await confirm(
			options.yes,
			'This will erase the selected drive. Are you sure?',
		);

		const { sourceDestination, multiWrite } = await import('etcher-sdk');
		const file = new sourceDestination.File({
			path: params.image,
		});
		const source = await file.getInnerSource();

		const visuals = getVisuals();
		const progressBars: { [key: string]: any } = {
			flashing: new visuals.Progress('Flashing'),
			verifying: new visuals.Progress('Validating'),
		};

		await multiWrite.pipeSourceToDestinations({
			source,
			destinations: [drive],
			onFail: (_, error) => {
				console.error(getChalk().red.bold(error.message));
				if (error.message.includes('EACCES')) {
					console.error(
						getChalk().red.bold(
							'Try running this command with elevated privileges, with sudo or in a shell running with admininstrator privileges.',
						),
					);
				}
			},
			onProgress: (progress) => {
				progressBars[progress.type].update(progress);
			},
			verify: true,
		});
	}

	async getDrive(options: { drive?: string }): Promise<BlockDevice> {
		const drive = options.drive || (await getVisuals().drive('Select a drive'));

		const sdk = await import('etcher-sdk');

		const adapter = new sdk.scanner.adapters.BlockDeviceAdapter({
			includeSystemDrives: () => false,
			unmountOnSuccess: false,
			write: true,
			direct: true,
		});
		const scanner = new sdk.scanner.Scanner([adapter]);
		await scanner.start();
		try {
			const d = scanner.getBy('device', drive);
			if (
				d === undefined ||
				!(d instanceof sdk.sourceDestination.BlockDevice)
			) {
				throw new ExpectedError(`Drive not found: ${options.drive}`);
			}
			return d;
		} finally {
			scanner.stop();
		}
	}
}
