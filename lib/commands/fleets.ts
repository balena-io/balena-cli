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

import { flags } from '@oclif/command';

import Command from '../command';
import * as cf from '../utils/common-flags';
import { getBalenaSdk, stripIndent } from '../utils/lazy';
import { isV14 } from '../utils/version';
import type { DataSetOutputOptions } from '../framework';

interface ExtendedApplication extends ApplicationWithDeviceType {
	device_count: number;
	online_devices: number;
	device_type?: string;
}

interface FlagsDef extends DataSetOutputOptions {
	help: void;
	verbose?: boolean;
}

export default class FleetsCmd extends Command {
	public static description = stripIndent`
		List all fleets.

		List all your balena fleets.

		For detailed information on a particular fleet, use
		\`balena fleet <fleet>\`
	`;

	public static examples = ['$ balena fleets'];

	public static usage = 'fleets';

	public static flags: flags.Input<FlagsDef> = {
		...(isV14() ? cf.dataSetOutputFlags : {}),
		help: cf.help,
	};

	public static authenticated = true;
	public static primary = true;

	public async run() {
		const { flags: options } = this.parse<FlagsDef, {}>(FleetsCmd);

		const balena = getBalenaSdk();

		// Get applications
		const applications =
			(await balena.models.application.getAllDirectlyAccessible({
				$select: ['id', 'app_name', 'slug'],
				$expand: {
					is_for__device_type: { $select: 'slug' },
					owns__device: { $select: 'is_online' },
				},
			})) as ExtendedApplication[];

		// Add extended properties
		applications.forEach((application) => {
			application.device_count = application.owns__device?.length ?? 0;
			application.online_devices =
				application.owns__device?.filter((d) => d.is_online).length || 0;
			application.device_type = application.is_for__device_type[0].slug;
		});

		await this.outputData(
			applications,
			[
				'id',
				'app_name',
				'slug',
				'device_type',
				'device_count',
				'online_devices',
			],
			options,
		);
	}
}
