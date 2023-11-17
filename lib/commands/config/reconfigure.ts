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

import { Flags } from '@oclif/core';
import Command from '../../command.js';
import * as cf from '../../utils/common-flags.js';
import { getVisuals, stripIndent } from '../../utils/lazy.js';

export default class ConfigReconfigureCmd extends Command {
	public static description = stripIndent`
		Interactively reconfigure a balenaOS image file or attached media.

		Interactively reconfigure a balenaOS image file or attached media.

		This command extracts the device UUID from the 'config.json' file of the
		chosen balenaOS image file or attached media, and then passes the UUID as
		the '--device' argument to the 'balena os configure' command.

		For finer-grained or scripted control of the operation, use the
		'balena config read' and 'balena os configure' commands separately.
`;
	public static examples = [
		'$ balena config reconfigure',
		'$ balena config reconfigure --drive /dev/disk3',
		'$ balena config reconfigure --drive balena.img --advanced',
	];

	public static usage = 'config reconfigure';

	public static flags = {
		drive: cf.driveOrImg,
		advanced: Flags.boolean({
			description: 'show advanced commands',
			char: 'v',
		}),
		help: cf.help,
		version: Flags.string({
			description: 'balenaOS version, for example "2.32.0" or "2.44.0+rev1"',
		}),
	};

	public static authenticated = true;
	public static root = true;

	public async run() {
		const { flags: options } = await this.parse(ConfigReconfigureCmd);

		const { safeUmount } = await import('../../utils/umount.js');

		const drive =
			options.drive || (await getVisuals().drive('Select the device drive'));
		await safeUmount(drive);

		const config = await import('balena-config-json');
		const { uuid } = await config.read(drive, '');
		await safeUmount(drive);

		if (!uuid) {
			const { ExpectedError } = await import('../../errors.js');
			throw new ExpectedError(
				`Error: UUID not found in 'config.json' file for '${drive}'`,
			);
		}

		const configureCommand = ['os', 'configure', drive, '--device', uuid];
		if (options.version) {
			configureCommand.push('--version', options.version);
		}
		if (options.advanced) {
			configureCommand.push('--advanced');
		}

		const { runCommand } = await import('../../utils/helpers.js');
		await runCommand(configureCommand);

		console.info('Done');
	}
}
