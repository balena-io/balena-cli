/**
 * @license
 * Copyright 2016-2021 Balena Ltd.
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
import { getVisuals, stripIndent } from '../../utils/lazy';

interface FlagsDef {
	type?: string;
	drive?: string;
	advanced: boolean;
	help: void;
}

export default class ConfigReconfigureCmd extends Command {
	public static description = stripIndent`
		Interactively reconfigure a device or OS image.

		Interactively reconfigure a provisioned device or OS image.
`;
	public static examples = [
		'$ balena config reconfigure',
		'$ balena config reconfigure --advanced',
		'$ balena config reconfigure --drive /dev/disk2',
	];

	public static usage = 'config reconfigure';

	public static flags: flags.Input<FlagsDef> = {
		type: cf.deviceTypeIgnored,
		drive: cf.driveOrImg,
		advanced: flags.boolean({
			description: 'show advanced commands',
			char: 'v',
		}),
		help: cf.help,
	};

	public static authenticated = true;

	public static root = true;

	public async run() {
		const { flags: options } = this.parse<FlagsDef, {}>(ConfigReconfigureCmd);

		const { safeUmount } = await import('../../utils/umount');

		const drive =
			options.drive || (await getVisuals().drive('Select the device drive'));
		await safeUmount(drive);

		const config = await import('balena-config-json');
		const { uuid } = await config.read(drive, '');
		await safeUmount(drive);

		const configureCommand = ['os', 'configure', drive, '--device', uuid];
		if (options.advanced) {
			configureCommand.push('--advanced');
		}

		const { runCommand } = await import('../../utils/helpers');
		await runCommand(configureCommand);

		console.info('Done');
	}
}
