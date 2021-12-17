/**
 * @license
 * Copyright 2016-2021 Balena Ltd.
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
import type { Release } from 'balena-sdk';

import Command from '../../command';
import * as cf from '../../utils/common-flags';
import * as ca from '../../utils/common-args';
import { getBalenaSdk, getVisuals, stripIndent } from '../../utils/lazy';
import { applicationIdInfo } from '../../utils/messages';
import { isV14 } from '../../utils/version';
import type { DataOutputOptions } from '../../framework';

interface FlagsDef extends DataOutputOptions {
	help: void;
}

interface ArgsDef {
	fleet: string;
}

export default class FleetCmd extends Command {
	public static description = stripIndent`
		Display information about a single fleet.

		Display detailed information about a single fleet.

		${applicationIdInfo.split('\n').join('\n\t\t')}
`;
	public static examples = [
		'$ balena fleet MyFleet',
		'$ balena fleet myorg/myfleet',
	];

	public static args = [ca.fleetRequired];

	public static usage = 'fleet <fleet>';

	public static flags: flags.Input<FlagsDef> = {
		help: cf.help,
		...(isV14() ? cf.dataOutputFlags : {}),
	};

	public static authenticated = true;
	public static primary = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			FleetCmd,
		);

		const { getApplication } = await import('../../utils/sdk');

		const application = (await getApplication(getBalenaSdk(), params.fleet, {
			$expand: {
				is_for__device_type: { $select: 'slug' },
				should_be_running__release: { $select: 'commit' },
			},
		})) as ApplicationWithDeviceType & {
			should_be_running__release: [Release?];
			// For display purposes:
			device_type: string;
			commit?: string;
		};

		application.device_type = application.is_for__device_type[0].slug;
		application.commit = application.should_be_running__release[0]?.commit;

		if (isV14()) {
			await this.outputData(
				application,
				['app_name', 'id', 'device_type', 'slug', 'commit'],
				options,
			);
		} else {
			// Emulate table.vertical title output, but avoid uppercasing and inserting spaces
			console.log(`== ${application.app_name}`);
			console.log(
				getVisuals().table.vertical(application, [
					'id',
					'device_type',
					'slug',
					'commit',
				]),
			);
		}
	}
}
