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

import { flags } from '@oclif/command';
import Command from '../../command';
import { ExpectedError } from '../../errors';
import * as cf from '../../utils/common-flags';
import {
	getChalk,
	getCliForm,
	getVisuals,
	stripIndent,
} from '../../utils/lazy';
import type * as SDK from 'etcher-sdk';

interface FlagsDef {
	yes: boolean;
	drive?: string;
	help: void;
}

interface ArgsDef {
	image: string;
}

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

	public static args = [
		{
			name: 'image',
			description: 'path to OS image',
			required: true,
		},
	];

	public static usage = 'local flash <image>';

	public static flags: flags.Input<FlagsDef> = {
		drive: cf.drive,
		yes: cf.yes,
		help: cf.help,
	};

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			LocalFlashCmd,
		);

		const { sourceDestination, multiWrite } = await import('etcher-sdk');

		const drive = await this.getDrive(options);

		const yes =
			options.yes ||
			(await getCliForm().ask({
				message: 'This will erase the selected drive. Are you sure?',
				type: 'confirm',
				name: 'yes',
				default: false,
			}));

		if (!yes) {
			console.log(getChalk().red.bold('Aborted image flash'));
			process.exit(0);
		}

		const file = new sourceDestination.File(
			params.image,
			sourceDestination.File.OpenFlags.Read,
		);
		const source = await file.getInnerSource();

		const visuals = getVisuals();
		const progressBars: { [key: string]: any } = {
			flashing: new visuals.Progress('Flashing'),
			verifying: new visuals.Progress('Validating'),
		};

		await multiWrite.pipeSourceToDestinations(
			source,
			[drive],
			(_, error) => {
				// onFail
				console.log(getChalk().red.bold(error.message));
			},
			(progress: SDK.multiWrite.MultiDestinationProgress) => {
				// onProgress
				progressBars[progress.type].update(progress);
			},
			true, // verify
		);
	}

	async getDrive(options: {
		drive?: string;
	}): Promise<SDK.sourceDestination.BlockDevice> {
		const drive = options.drive || (await getVisuals().drive('Select a drive'));

		const sdk = await import('etcher-sdk');

		const adapter = new sdk.scanner.adapters.BlockDeviceAdapter(() => false);
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
