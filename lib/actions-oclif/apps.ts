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
import { isV12 } from '../utils/version';
import { table } from 'cli-ux/lib/styled/table';

interface ExtendedApplication extends ApplicationWithDeviceType {
	device_count?: number;
	online_devices?: number;
}

interface FlagsDef {
	help: void;
	verbose?: boolean;
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
		...table.flags(),
		help: cf.help,
		verbose: flags.boolean({
			char: 'v',
			description: isV12()
				? 'No-op since release v12.0.0'
				: 'add extra columns in the tabular output (SLUG)',
		}),
	};

	public static authenticated = true;
	public static primary = true;

	public async run() {
		const { flags: options } = this.parse<FlagsDef, {}>(AppsCmd);

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
		const displayApps = applications.map((app) => {
			return {
				id: app.id,
				app_name: app.app_name,
				slug: app.slug,
				device_type: app.is_for__device_type[0].slug,
				online_devices: _.sumBy(app.owns__device, (d) =>
					d.is_online === true ? 1 : 0,
				),
				device_count: app.owns__device?.length ?? 0,
			};
		});

		// Display
		console.log(
			getVisuals().table.horizontal(displayApps, [
				'id',
				'app_name',
				options.verbose || isV12() ? 'slug' : '',
				'device_type',
				'online_devices',
				'device_count',
			]),
		);
		table(
			displayApps,
			{
				id: {},
				app_name: {},
				...(options.verbose || isV12() ? { slug: {} } : {}),
				device_type: {},
				online_devices: {},
				device_count: {},
			},
			options,
		);
	}
}
