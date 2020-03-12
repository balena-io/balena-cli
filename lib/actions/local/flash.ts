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
import { stripIndent } from 'common-tags';
import * as SDK from 'etcher-sdk';
import { getChalk, getVisuals } from '../../utils/lazy';

async function getDrive(options: {
	drive?: string;
}): Promise<SDK.sourceDestination.BlockDevice> {
	return options.drive || getVisuals().drive('Select a drive');
}

export const flash: CommandDefinition<
	{ image: string },
	{ drive: string; yes: boolean }
> = {
	signature: 'local flash <image>',
	description: 'Flash an image to a drive',
	help: stripIndent`
		Use this command to flash a balenaOS image to a drive.

		Examples:

			$ balena local flash path/to/balenaos.img[.zip|.gz|.bz2|.xz]
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
	},
};
