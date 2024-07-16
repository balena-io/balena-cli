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

import Command from '../../command.js';
import { ExpectedError } from '../../errors.js';
import * as cf from '../../utils/common-flags.js';
import { getBalenaSdk, getVisuals, stripIndent } from '../../utils/lazy.js';
import { applicationIdInfo } from '../../utils/messages.js';

export default class TagsCmd extends Command {
	public static description = stripIndent`
		List all tags for a fleet, device or release.

		List all tags and their values for the specified fleet, device or release.

		${applicationIdInfo.split('\n').join('\n\t\t')}
	`;

	public static examples = [
		'$ balena tags --fleet MyFleet',
		'$ balena tags -f myorg/myfleet',
		'$ balena tags --device 7cf02a6',
		'$ balena tags --release 1234',
		'$ balena tags --release b376b0e544e9429483b656490e5b9443b4349bd6',
	];

	public static usage = 'tags';

	public static flags = {
		fleet: {
			...cf.fleet,
			exclusive: ['device', 'release'],
		},
		device: {
			...cf.device,
			exclusive: ['fleet', 'release'],
		},
		release: {
			...cf.release,
			exclusive: ['fleet', 'device'],
		},
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { flags: options } = await this.parse(TagsCmd);

		const balena = getBalenaSdk();

		// Check user has specified one of application/device/release
		if (!options.fleet && !options.device && !options.release) {
			throw new ExpectedError(this.missingResourceMessage);
		}

		let tags;

		if (options.fleet) {
			const { getFleetSlug } = await import('../../utils/sdk.js');
			tags = await balena.models.application.tags.getAllByApplication(
				await getFleetSlug(balena, options.fleet),
			);
		}
		if (options.device) {
			tags = await balena.models.device.tags.getAllByDevice(options.device);
		}
		if (options.release) {
			const { disambiguateReleaseParam } = await import(
				'../../utils/normalization.js'
			);
			const releaseParam = await disambiguateReleaseParam(
				balena,
				options.release,
			);

			tags = await balena.models.release.tags.getAllByRelease(releaseParam);
		}

		if (!tags || tags.length === 0) {
			throw new ExpectedError('No tags found');
		}

		console.log(getVisuals().table.horizontal(tags, ['tag_key', 'value']));
	}

	protected missingResourceMessage = stripIndent`
					To list tags for a resource, you must provide exactly one of:

					  * A fleet, with --fleet <fleetNameOrSlug>
					  * A device, with --device <uuid>
					  * A release, with --release <id or commit>

					See the help page for examples:

					  $ balena help tags
	`;
}
