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
import { Application } from 'balena-sdk';
import { stripIndent } from 'common-tags';
import Command from '../command';
import * as cf from '../utils/common-flags';
import { getBalenaSdk, getVisuals } from '../utils/lazy';

interface ExtendedApplication extends Application {
	device_count?: number;
	online_devices?: number;
}

interface FlagsDef {
	help: void;
}

export default class AppsCmd extends Command {
	public static description = stripIndent`
		List all applications.

		list all your balena applications.

		For detailed information on a particular application,
		use \`balena app <name> instead\`.
`;
	public static examples = ['$ balena apps'];

	public static usage = 'apps';

	public static flags: flags.Input<FlagsDef> = {
		help: cf.help,
	};

	public static authenticated = true;
	public static primary = true;

	public async run() {
		this.parse<FlagsDef, {}>(AppsCmd);

		const _ = await import('lodash');
		const balena = getBalenaSdk();

		// Get applications
		const applications: ExtendedApplication[] = await balena.models.application.getAll(
			{
				$select: ['id', 'app_name', 'device_type'],
				$expand: { owns__device: { $select: 'is_online' } },
			},
		);

		// Add extended properties
		applications.forEach(application => {
			application.device_count = _.size(application.owns__device);
			application.online_devices = _.sumBy(application.owns__device, d =>
				d.is_online === true ? 1 : 0,
			);
		});

		// Display
		console.log(
			getVisuals().table.horizontal(applications, [
				'id',
				'app_name',
				'device_type',
				'online_devices',
				'device_count',
			]),
		);
	}
}
