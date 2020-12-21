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
import { getBalenaSdk, stripIndent } from '../../utils/lazy';
import { applicationIdInfo } from '../../utils/messages';

interface FlagsDef {
	application?: string;
	device?: string;
	release?: string;
	help: void;
	app?: string;
}

interface ArgsDef {
	tagKey: string;
}

export default class TagRmCmd extends Command {
	public static description = stripIndent`
		Remove a tag from an application, device or release.

		Remove a tag from an application, device or release.

		${applicationIdInfo.split('\n').join('\n\t\t')}
	`;

	public static examples = [
		'$ balena tag rm myTagKey --application MyApp',
		'$ balena tag rm myTagKey -a myorg/myapp',
		'$ balena tag rm myTagKey --device 7cf02a6',
		'$ balena tag rm myTagKey --release 1234',
		'$ balena tag rm myTagKey --release b376b0e544e9429483b656490e5b9443b4349bd6',
	];

	public static args = [
		{
			name: 'tagKey',
			description: 'the key string of the tag',
			required: true,
		},
	];

	public static usage = 'tag rm <tagKey>';

	public static flags: flags.Input<FlagsDef> = {
		application: {
			...cf.application,
			exclusive: ['app', 'device', 'release'],
		},
		app: {
			...cf.app,
			exclusive: ['application', 'device', 'release'],
		},
		device: {
			...cf.device,
			exclusive: ['app', 'application', 'release'],
		},
		release: {
			...cf.release,
			exclusive: ['app', 'application', 'device'],
		},
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			TagRmCmd,
		);

		// Prefer options.application over options.app
		options.application = options.application || options.app;
		delete options.app;

		const balena = getBalenaSdk();

		// Check user has specified one of application/device/release
		if (!options.application && !options.device && !options.release) {
			const { ExpectedError } = await import('../../errors');
			throw new ExpectedError(TagRmCmd.missingResourceMessage);
		}

		const { tryAsInteger } = await import('../../utils/validation');

		if (options.application) {
			const { getTypedApplicationIdentifier } = await import('../../utils/sdk');
			return balena.models.application.tags.remove(
				await getTypedApplicationIdentifier(balena, options.application),
				params.tagKey,
			);
		}
		if (options.device) {
			return balena.models.device.tags.remove(
				tryAsInteger(options.device),
				params.tagKey,
			);
		}
		if (options.release) {
			const { disambiguateReleaseParam } = await import(
				'../../utils/normalization'
			);
			const releaseParam = await disambiguateReleaseParam(
				balena,
				options.release,
			);

			return balena.models.release.tags.remove(releaseParam, params.tagKey);
		}
	}

	protected static missingResourceMessage = stripIndent`
					To remove a resource tag, you must provide exactly one of:

					  * An application, with --application <appNameOrSlug>
					  * A device, with --device <uuid>
					  * A release, with --release <id or commit>

					See the help page for examples:

					  $ balena help tag rm
	`;
}
