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
import Command from '../command';
import { ExpectedError } from '../errors';
import * as cf from '../utils/common-flags';
import { getBalenaSdk, getVisuals, stripIndent } from '../utils/lazy';
import { disambiguateReleaseParam } from '../utils/normalization';
import { tryAsInteger } from '../utils/validation';
import { isV12 } from '../utils/version';

interface FlagsDef {
	application?: string;
	device?: string;
	release?: string;
	help: void;
	app?: string;
}

export default class TagsCmd extends Command {
	public static description = stripIndent`
		List all tags for an application, device or release.

		List all tags and their values for a particular application,
		device or release.
	`;

	public static examples = [
		'$ balena tags --application MyApp',
		'$ balena tags --device 7cf02a6',
		'$ balena tags --release 1234',
		'$ balena tags --release b376b0e544e9429483b656490e5b9443b4349bd6',
	];

	public static flags: flags.Input<FlagsDef> = {
		application: {
			...cf.application,
			exclusive: ['app', 'device', 'release'],
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
		app: flags.string({
			description: "same as '--application'",
			exclusive: ['application', 'device', 'release'],
		}),
	};

	public static authenticated = true;

	public async run() {
		const { flags: options } = this.parse<FlagsDef, {}>(TagsCmd);

		// Prefer options.application over options.app
		options.application = options.application || options.app;
		delete options.app;

		const balena = getBalenaSdk();

		// Check user has specified one of application/device/release
		if (!options.application && !options.device && !options.release) {
			throw new ExpectedError(this.missingResourceMessage);
		}

		let tags;

		if (options.application) {
			tags = await balena.models.application.tags.getAllByApplication(
				tryAsInteger(options.application),
			);
		}
		if (options.device) {
			tags = await balena.models.device.tags.getAllByDevice(
				tryAsInteger(options.device),
			);
		}
		if (options.release) {
			const releaseParam = await disambiguateReleaseParam(
				balena,
				options.release,
			);

			tags = await balena.models.release.tags.getAllByRelease(releaseParam);
		}

		if (!tags || tags.length === 0) {
			throw new ExpectedError('No tags found');
		}

		console.log(
			isV12()
				? getVisuals().table.horizontal(tags, ['tag_key', 'value'])
				: getVisuals().table.horizontal(tags, ['id', 'tag_key', 'value']),
		);
	}

	protected missingResourceMessage = stripIndent`
					To list tags for a resource, you must provide exactly one of:

					  * An application, with --application <appname>
					  * A device, with --device <uuid>
					  * A release, with --release <id or commit>

					See the help page for examples:

					  $ balena help tags
	`;
}
