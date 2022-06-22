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

import type { flags } from '@oclif/command';

import Command from '../../command';
import * as cf from '../../utils/common-flags';
import * as ca from '../../utils/common-args';
import { getBalenaSdk, getVisuals, stripIndent } from '../../utils/lazy';
import { applicationIdInfo } from '../../utils/messages';

interface FlagsDef {
	help: void;
}

interface ArgsDef {
	fleet: string;
}

export default class FleetReleasesCmd extends Command {
	public static description = stripIndent`
		See a fleet's releases.

		See a fleet's releases.

		${applicationIdInfo.split('\n').join('\n\t\t')}
	`;

	public static examples = ['$ balena fleet releases 1873608'];

	public static args = [ca.fleetRequired];

	public static usage = 'fleet releases <fleet>';

	public static flags: flags.Input<FlagsDef> = {
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = this.parse<FlagsDef, ArgsDef>(FleetReleasesCmd);

		const { ExpectedError } = await import('../../errors');

		const balena = getBalenaSdk();

		// Disambiguate target application (if params.params is a number, it could either be an ID or a numerical name)
		const { getApplication } = await import('../../utils/sdk');
		const application = await getApplication(balena, params.fleet);

		// Check app exists
		if (!application) {
			throw new ExpectedError(`Error: fleet ${params.fleet} not found.`);
		}

		try {
			const cmdOutput = await balena.models.release.getAllByApplication(
				params.fleet,
				{
					$select: [
						'commit',
						'end_timestamp',
						'raw_version',
						'is_final',
						'is_invalidated',
					],
					$expand: { is_running_on__device: { $count: {} } },
				},
			);
			console.log(
				getVisuals().table.horizontal(cmdOutput, [
					'commit',
					'end_timestamp',
					'raw_version',
					'is_final',
					'is_invalidated',
					'is_running_on__device => RUNNING ON',
				]),
			);
		} catch (e) {
			throw e;
		}
	}
}
