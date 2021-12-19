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
	fleet?: string;
	device?: string;
	release?: string;
	help: void;
}

interface ArgsDef {
	tagKey: string;
	value?: string;
}

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

	public static args = [
		{
			name: 'tagKey',
			description: 'the key string of the tag',
			required: true,
		},
		{
			name: 'value',
			description: 'the optional value associated with the tag',
			required: false,
		},
	];

	public static usage = 'tag set <tagKey> [value]';

	public static flags: flags.Input<FlagsDef> = {
		fleet: {
			...cf.fleet,
			exclusive: ['app', 'application', 'device', 'release'],
		},
		device: {
			...cf.device,
			exclusive: ['app', 'application', 'fleet', 'release'],
		},
		release: {
			...cf.release,
			exclusive: ['app', 'application', 'fleet', 'device'],
		},
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			TagSetCmd,
		);

		const balena = getBalenaSdk();

		// Check user has specified one of application/device/release
		if (!options.fleet && !options.device && !options.release) {
			const { ExpectedError } = await import('../../errors');
			throw new ExpectedError(TagSetCmd.missingResourceMessage);
		}

		params.value ??= '';

		const { tryAsInteger } = await import('../../utils/validation');

		if (options.fleet) {
			const { getTypedApplicationIdentifier } = await import('../../utils/sdk');
			return balena.models.application.tags.set(
				await getTypedApplicationIdentifier(balena, options.fleet),
				params.tagKey,
				params.value,
			);
		}
		if (options.device) {
			return balena.models.device.tags.set(
				tryAsInteger(options.device),
				params.tagKey,
				params.value,
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
