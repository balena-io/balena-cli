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
import { getExpandedProp } from '../../utils/pine.js';

export default class FleetPinCmd extends Command {
	public static description = stripIndent`
		Pin a fleet to a release.

		Pin a fleet to a release.

		Note, if the commit is omitted, the currently pinned release will be printed, with instructions for how to see a list of releases
		`;
	public static examples = [
		'$ balena fleet pin myfleet',
		'$ balena fleet pin myorg/myfleet 91165e5',
	];

	public static args = {
		slug: Args.string({
			description: 'the slug of the fleet to pin to a release',
			required: true,
		}),
		releaseToPinTo: Args.string({
			description: 'the commit of the release for the fleet to get pinned to',
		}),
	};

	public static usage = 'fleet pin <slug> [releaseToPinTo]';

	public static flags = {
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = await this.parse(FleetPinCmd);

		const balena = getBalenaSdk();

		const fleet = await balena.models.application.get(params.slug, {
			$expand: {
				should_be_running__release: {
					$select: 'commit',
				},
			},
		});

		const pinnedRelease = getExpandedProp(
			fleet.should_be_running__release,
			'commit',
		);

		const releaseToPinTo = params.releaseToPinTo;
		const slug = params.slug;

		if (!releaseToPinTo) {
			console.log(
				`${
					pinnedRelease
						? `This fleet is currently pinned to ${pinnedRelease}.`
						: 'This fleet is not currently pinned to any release.'
				} \n\nTo see a list of all releases this fleet can be pinned to, run \`balena releases ${slug}\`.`,
			);
		} else {
			await balena.models.application.pinToRelease(slug, releaseToPinTo);
		}
	}
}
