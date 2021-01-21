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
import * as cf from '../../utils/common-flags';
import { stripIndent, getChalk, getVisuals } from '../../utils/lazy';

interface FlagsDef {
	help: void;
}

export default class UtilAvailableDrivesCmd extends Command {
	public static description = stripIndent`
		List available drives.

		List available drives which are usable for writing an OS image to.
		Does not list system drives.
	`;

	public static usage = 'util available-drives';

	public static flags: flags.Input<FlagsDef> = {
		help: cf.help,
	};

	public async run() {
		this.parse<FlagsDef, {}>(UtilAvailableDrivesCmd);

		const sdk = await import('etcher-sdk');

		const adapter = new sdk.scanner.adapters.BlockDeviceAdapter({
			includeSystemDrives: () => false,
		});
		const scanner = new sdk.scanner.Scanner([adapter]);
		await scanner.start();

		function prepareDriveInfo(drive: any) {
			const size = drive.size / 1000000000;
			return {
				device: drive.device,
				size: `${size.toFixed(1)} GB`,
				description: drive.description,
			};
		}

		if (scanner.drives.size === 0) {
			console.error(
				`${getChalk().red(
					'x',
				)} No available drives were detected, plug one in!`,
			);
		} else {
			console.log(
				getVisuals().table.horizontal(
					Array.from(scanner.drives).map(prepareDriveInfo),
					['device', 'size', 'description'],
				),
			);
		}
		scanner.stop();
	}
}
