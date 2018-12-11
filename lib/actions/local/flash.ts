/*
Copyright 2017 Balena

Licensed under the Apache License, Version 2.0 (the 'License');
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

	 http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an 'AS IS' BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { CommandDefinition } from 'capitano';
import chalk from 'chalk';
import { stripIndent } from 'common-tags';
import * as sdk from 'etcher-sdk';

import { DriveList } from '../../utils/visuals/drive-list';

async function getDrive(options: {
	drive?: string;
}): Promise<sdk.sourceDestination.BlockDevice> {
	const sdk = await import('etcher-sdk');

	const adapter = new sdk.scanner.adapters.BlockDeviceAdapter(() => false);
	const scanner = new sdk.scanner.Scanner([adapter]);
	await scanner.start();
	let drive: sdk.sourceDestination.BlockDevice;
	if (options.drive !== undefined) {
		const d = scanner.getBy('device', options.drive);
		if (d === undefined || !(d instanceof sdk.sourceDestination.BlockDevice)) {
			throw new Error(`Drive not found: ${options.drive}`);
		}
		drive = d;
	} else {
		const driveList = new DriveList(scanner);
		drive = await driveList.run();
	}
	scanner.stop();
	return drive;
}

export const flash: CommandDefinition<
	{ image: string },
	{ drive: string; yes: boolean }
> = {
	signature: 'local flash <image>',
	description: 'Flash an image to a drive',
	//root: true,
	help: stripIndent`
		Use this command to flash a balenaOS image to a drive.

		Examples:

			$ balena local flash path/to/balenaos.img
			$ balena local flash path/to/balenaos.img --drive /dev/disk2
			$ balena local flash path/to/balenaos.img --drive /dev/disk2 --yes
	`,
	options: [
		{
			signature: 'yes',
			boolean: true,
			description: 'confirm non-interactively',
			alias: 'y',
		},
		{
			signature: 'drive',
			parameter: 'drive',
			description: 'drive',
			alias: 'd',
		},
	],
	async action(params, options) {
		const visuals = await import('resin-cli-visuals');
		const form = await import('resin-cli-form');
		const { sourceDestination, multiWrite } = await import('etcher-sdk');

		const drive = await getDrive(options);

		const yes =
			options.yes ||
			(await form.ask({
				message: 'This will erase the selected drive. Are you sure?',
				type: 'confirm',
				name: 'yes',
				default: false,
			}));
		if (yes !== true) {
			console.log(chalk.red.bold('Aborted image flash'));
			process.exit(0);
		}

		const source = new sourceDestination.File(
			params.image,
			sourceDestination.File.OpenFlags.Read,
		);

		const progressBars: { [key: string]: any } = {
			flashing: new visuals.Progress('Flashing'),
			verifying: new visuals.Progress('Validating'),
		};

		await multiWrite.pipeSourceToDestinations(
			source,
			[drive],
			(_, error) => {
				// onFail
				console.log(chalk.red.bold(error.message));
			},
			(progress: sdk.multiWrite.MultiDestinationProgress) => {
				// onProgress
				progressBars[progress.type].update(progress);
			},
			true, // verify
		);
	},
};
