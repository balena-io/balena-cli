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
import { getCliForm, stripIndent } from '../../utils/lazy';

interface FlagsDef {
	type: string;
	drive?: string;
	yes: boolean;
	help: void;
}

interface ArgsDef {
	image: string;
}

const INIT_WARNING_MESSAGE = `

Note: Initializing the device may ask for administrative permissions
because we need to access the raw devices directly.\
`;

export default class OsInitializeCmd extends Command {
	public static description = stripIndent`
		Initialize an os image for a device.

		Initialize an os image for a device with a previously
		configured operating system image.
		${INIT_WARNING_MESSAGE}
	`;

	public static examples = [
		'$ balena os initialize ../path/rpi.img --type raspberry-pi',
	];

	public static args = [
		{
			name: 'image',
			description: 'path to OS image',
			required: true,
		},
	];

	public static usage = 'os initialize <image>';

	public static flags: flags.Input<FlagsDef> = {
		type: cf.deviceType,
		drive: cf.drive,
		yes: cf.yes,
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			OsInitializeCmd,
		);

		const { getManifest, sudo } = await import('../../utils/helpers');

		console.info(`Initializing device ${INIT_WARNING_MESSAGE}`);

		const manifest = await getManifest(params.image, options.type);

		const answers = await getCliForm().run(manifest.initialization?.options, {
			override: {
				drive: options.drive,
			},
		});

		if (answers.drive != null) {
			const { confirm } = await import('../../utils/patterns');
			await confirm(
				options.yes,
				`This will erase ${answers.drive}. Are you sure?`,
				`Going to erase ${answers.drive}.`,
			);
			const { safeUmount } = await import('../../utils/umount');
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
			const { safeUmount } = await import('../../utils/umount');
			await safeUmount(answers.drive);
			console.info(`You can safely remove ${answers.drive} now`);
		}
	}
}
