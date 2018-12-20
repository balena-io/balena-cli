/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
/*
Copyright 2016-2017 Balena

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { CommandDefinition } from 'capitano';
import chalk from 'chalk';
import { stripIndent } from 'common-tags';

export const availableDrives: CommandDefinition<{}, {}> = {
	signature: 'util available-drives',
	description: 'list available drives',
	help: stripIndent`
		Use this command to list your machine's drives usable for writing the OS image to.
		Skips the system drives.
	`,
	async action() {
		const sdk = await import('etcher-sdk');
		const visuals = await import('resin-cli-visuals');

		const adapter = new sdk.scanner.adapters.BlockDeviceAdapter(() => false);
		const scanner = new sdk.scanner.Scanner([adapter]);
		await scanner.start();

		function formatDrive(drive: any) {
			const size = drive.size / 1000000000;
			return {
				device: drive.device,
				size: `${size.toFixed(1)} GB`,
				description: drive.description,
			};
		}

		if (scanner.drives.size === 0) {
			console.error(
				`${chalk.red('x')} No available drives were detected, plug one in!`,
			);
		} else {
			console.log(
				visuals.table.horizontal(Array.from(scanner.drives).map(formatDrive), [
					'device',
					'size',
					'description',
				]),
			);
		}
		scanner.stop();
	},
};
