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
import Command from '../command';
import * as cf from '../utils/common-flags';
import { getBalenaSdk, getVisuals, stripIndent } from '../utils/lazy';

interface ExtendedApplication extends ApplicationWithDeviceType {
	device_count?: number;
	online_devices?: number;
}

interface FlagsDef {
	help: void;
	verbose: boolean;
}

export default class AppsCmd extends Command {
	public static description = stripIndent`
		List all applications.

		list all your balena applications.

		For detailed information on a particular application,
		use \`balena app <application>\` instead.
	`;

	public static examples = ['$ balena apps'];

	public static usage = 'apps';

	public static flags: flags.Input<FlagsDef> = {
		help: cf.help,
		verbose: flags.boolean({
			default: false,
			char: 'v',
			description: 'No-op since release v12.0.0',
		}),
	};

	public static authenticated = true;
	public static primary = true;

	public async run() {
		this.parse<FlagsDef, {}>(AppsCmd);

		const balena = getBalenaSdk();

		// Get applications
		const applications = (await balena.models.application.getAll({
			$select: ['id', 'app_name', 'slug'],
			$expand: {
				is_for__device_type: { $select: 'slug' },
				owns__device: { $select: 'is_online' },
			},
		})) as ExtendedApplication[];

		const _ = await import('lodash');
		// Add extended properties
		applications.forEach((application) => {
			application.device_count = application.owns__device?.length ?? 0;
			application.online_devices = _.sumBy(application.owns__device, (d) =>
				d.is_online === true ? 1 : 0,
			);
			// @ts-expect-error
			application.device_type = application.is_for__device_type[0].slug;
		});

		// Display
		console.log(
			getVisuals().table.horizontal(applications, [
				'id',
				'app_name',
				'slug',
				'device_type',
				'online_devices',
				'device_count',
			]),
		);
	}
}
