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

export default class DeviceTrackFleetCmd extends Command {
	public static description = stripIndent`
		Make a device track the fleet's pinned release.

		Make a device track the fleet's pinned release.
		`;
	public static examples = ['$ balena device track-fleet 7cf02a6'];

	public static args = {
		uuid: Args.string({
			description: "the uuid of the device to make track the fleet's release",
			required: true,
		}),
	};

	public static usage = 'device track-fleet <uuid>';

	public static flags = {
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = await this.parse(DeviceTrackFleetCmd);

		const balena = getBalenaSdk();

		await balena.models.device.trackApplicationRelease(params.uuid);
	}
}
