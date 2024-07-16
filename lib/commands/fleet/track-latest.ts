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

export default class FleetTrackLatestCmd extends Command {
	public static description = stripIndent`
		Make this fleet track the latest release.

		Make this fleet track the latest release.
		`;
	public static examples = [
		'$ balena fleet track-latest myorg/myfleet',
		'$ balena fleet track-latest myfleet',
	];

	public static args = {
		slug: Args.string({
			description: 'the slug of the fleet to make track the latest release',
			required: true,
		}),
	};

	public static usage = 'fleet track-latest <slug>';

	public static flags = {
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = await this.parse(FleetTrackLatestCmd);

		const balena = getBalenaSdk();

		await balena.models.application.trackLatestRelease(params.slug);
	}
}
