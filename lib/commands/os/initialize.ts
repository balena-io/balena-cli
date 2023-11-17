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

import { Args } from '@oclif/core';
import Command from '../../command.js';
import * as cf from '../../utils/common-flags.js';
import { getCliForm, stripIndent } from '../../utils/lazy.js';

const INIT_WARNING_MESSAGE = `

Note: Initializing the device may ask for administrative permissions
because we need to access the raw devices directly.\
`;

export default class OsInitializeCmd extends Command {
	public static description = stripIndent`
		Initialize an os image for a device.

		Initialize an os image for a device with a previously
		configured operating system image and flash the
		an external storage drive or the device's storage
		medium depending on the device type.
		${INIT_WARNING_MESSAGE}
	`;

	public static examples = [
		'$ balena os initialize ../path/rpi.img --type raspberry-pi',
	];

	public static args = {
		image: Args.string({
			description: 'path to OS image',
			required: true,
		}),
	};

	public static usage = 'os initialize <image>';

	public static flags = {
		type: cf.deviceType,
		drive: cf.drive,
		yes: cf.yes,
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(OsInitializeCmd);

		const { getManifest, sudo } = await import('../../utils/helpers.js');

		console.info(`Initializing device ${INIT_WARNING_MESSAGE}`);

		const manifest = await getManifest(params.image, options.type);

		const answers = await getCliForm().run(manifest.initialization?.options, {
			override: {
				drive: options.drive,
			},
		});

		if (answers.drive != null) {
			const { confirm } = await import('../../utils/patterns.js');
			await confirm(
				options.yes,
				`This will erase ${answers.drive}. Are you sure?`,
				`Going to erase ${answers.drive}.`,
			);
			const { safeUmount } = await import('../../utils/umount.js');
			await safeUmount(answers.drive);
		}

		await sudo([
			'internal',
			'osinit',
			params.image,
			options.type,
			JSON.stringify(answers),
		]);

		if (answers.drive != null) {
			const { safeUmount } = await import('../../utils/umount.js');
			await safeUmount(answers.drive);
			console.info(`You can safely remove ${answers.drive} now`);
		}
	}
}
