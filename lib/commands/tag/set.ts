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

import { Args } from '@oclif/core';
import Command from '../../command.js';
import * as cf from '../../utils/common-flags.js';
import { getBalenaSdk, stripIndent } from '../../utils/lazy.js';
import { applicationIdInfo } from '../../utils/messages.js';

export default class TagSetCmd extends Command {
	public static description = stripIndent`
		Set a tag on a fleet, device or release.

		Set a tag on a fleet, device or release.

		You can optionally provide a value to be associated with the created
		tag, as an extra argument after the tag key. If a value isn't
		provided, a tag with an empty value is created.

		${applicationIdInfo.split('\n').join('\n\t\t')}
	`;

	public static examples = [
		'$ balena tag set mySimpleTag --fleet MyFleet',
		'$ balena tag set mySimpleTag -f myorg/myfleet',
		'$ balena tag set myCompositeTag myTagValue --fleet MyFleet',
		'$ balena tag set myCompositeTag myTagValue --device 7cf02a6',
		'$ balena tag set myCompositeTag "my tag value with whitespaces" --device 7cf02a6',
		'$ balena tag set myCompositeTag myTagValue --release 1234',
		'$ balena tag set myCompositeTag --release 1234',
		'$ balena tag set myCompositeTag --release b376b0e544e9429483b656490e5b9443b4349bd6',
	];

	public static args = {
		tagKey: Args.string({
			description: 'the key string of the tag',
			required: true,
		}),
		value: Args.string({
			description: 'the optional value associated with the tag',
			required: false,
		}),
	};

	// Required for supporting empty string ('') `value` args.
	public static strict = false;
	public static usage = 'tag set <tagKey> [value]';

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
		const { args: params, flags: options } = await this.parse(TagSetCmd);

		const balena = getBalenaSdk();

		// Check user has specified one of application/device/release
		if (!options.fleet && !options.device && !options.release) {
			const { ExpectedError } = await import('../../errors.js');
			throw new ExpectedError(TagSetCmd.missingResourceMessage);
		}

		params.value ??= '';

		if (options.fleet) {
			const { getFleetSlug } = await import('../../utils/sdk.js');
			return balena.models.application.tags.set(
				await getFleetSlug(balena, options.fleet),
				params.tagKey,
				params.value,
			);
		}
		if (options.device) {
			return balena.models.device.tags.set(
				options.device,
				params.tagKey,
				params.value,
			);
		}
		if (options.release) {
			const { disambiguateReleaseParam } = await import(
				'../../utils/normalization.js'
			);
			const releaseParam = await disambiguateReleaseParam(
				balena,
				options.release,
			);

			return balena.models.release.tags.set(
				releaseParam,
				params.tagKey,
				params.value,
			);
		}
	}

	protected static missingResourceMessage = stripIndent`
					To set a resource tag, you must provide exactly one of:

					  * A fleet, with --fleet <fleetNameOrSlug>
					  * A device, with --device <UUID>
					  * A release, with --release <ID or commit>

					See the help page for examples:

					  $ balena help tag set
	`;
}
