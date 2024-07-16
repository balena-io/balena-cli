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

export default class DevicePinCmd extends Command {
	public static description = stripIndent`
		Pin a device to a release.

		Pin a device to a release.

		Note, if the commit is omitted, the currently pinned release will be printed, with instructions for how to see a list of releases
		`;
	public static examples = [
		'$ balena device pin 7cf02a6',
		'$ balena device pin 7cf02a6 91165e5',
	];

	public static args = {
		uuid: Args.string({
			description: 'the uuid of the device to pin to a release',
			required: true,
		}),
		releaseToPinTo: Args.string({
			description: 'the commit of the release for the device to get pinned to',
		}),
	};

	public static usage = 'device pin <uuid> [releaseToPinTo]';

	public static flags = {
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = await this.parse(DevicePinCmd);

		const balena = getBalenaSdk();

		const device = await balena.models.device.get(params.uuid, {
			$expand: {
				should_be_running__release: {
					$select: 'commit',
				},
				belongs_to__application: {
					$select: 'slug',
				},
			},
		});

		const pinnedRelease = getExpandedProp(
			device.should_be_running__release,
			'commit',
		);
		const appSlug = getExpandedProp(device.belongs_to__application, 'slug');

		const releaseToPinTo = params.releaseToPinTo;

		if (!releaseToPinTo) {
			console.log(
				`${
					pinnedRelease
						? `This device is currently pinned to ${pinnedRelease}.`
						: 'This device is not currently pinned to any release.'
				} \n\nTo see a list of all releases this device can be pinned to, run \`balena releases ${appSlug}\`.`,
			);
		} else {
			await balena.models.device.pinToRelease(params.uuid, releaseToPinTo);
		}
	}
}
