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
import { Flags } from '@oclif/core';
import type * as BalenaSdk from 'balena-sdk';
import _ from 'lodash';
import Command from '../../command.js';

import * as cf from '../../utils/common-flags.js';
import { getBalenaSdk, getVisuals, stripIndent } from '../../utils/lazy.js';
import { CommandHelp } from '../../utils/oclif-utils.js';

export default class DevicesSupportedCmd extends Command {
	public static description = stripIndent`
		List the supported device types (like 'raspberrypi3' or 'intel-nuc').

		List the supported device types (like 'raspberrypi3' or 'intel-nuc').

		The --json option is recommended when scripting the output of this command,
		because the JSON format is less likely to change and it better represents data
		types like lists and empty strings (for example, the ALIASES column contains a
		list of zero or more values). The 'jq' utility may be helpful in shell scripts
		(https://stedolan.github.io/jq/manual/).
`;
	public static examples = [
		'$ balena devices supported',
		'$ balena devices supported --json',
	];

	public static usage = (
		'devices supported ' +
		new CommandHelp({ args: DevicesSupportedCmd.args }).defaultUsage()
	).trim();

	public static flags = {
		help: cf.help,
		json: Flags.boolean({
			char: 'j',
			description: 'produce JSON output instead of tabular output',
		}),
	};

	public async run() {
		const { flags: options } = await this.parse(DevicesSupportedCmd);
		const pineOptions = {
			$select: ['slug', 'name'],
			$expand: {
				is_of__cpu_architecture: { $select: 'slug' },
				device_type_alias: {
					$select: 'is_referenced_by__alias',
					$orderby: { is_referenced_by__alias: 'asc' },
				},
			},
		} satisfies BalenaSdk.PineOptions<BalenaSdk.DeviceType>;
		const dts = (await getBalenaSdk().models.deviceType.getAllSupported(
			pineOptions,
		)) as Array<
			BalenaSdk.PineTypedResult<BalenaSdk.DeviceType, typeof pineOptions>
		>;
		interface DT {
			slug: string;
			aliases: string[];
			arch: string;
			name: string;
		}
		let deviceTypes = dts.map((dt): DT => {
			const aliases = dt.device_type_alias
				.map((dta) => dta.is_referenced_by__alias)
				.filter((alias) => alias !== dt.slug);
			return {
				slug: dt.slug,
				aliases: options.json ? aliases : [aliases.join(', ')],
				arch: dt.is_of__cpu_architecture[0]?.slug || 'n/a',
				name: dt.name || 'N/A',
			};
		});
		const fields = ['slug', 'aliases', 'arch', 'name'];
		deviceTypes = _.sortBy(deviceTypes, fields);
		if (options.json) {
			console.log(JSON.stringify(deviceTypes, null, 4));
		} else {
			const visuals = getVisuals();
			const output = await visuals.table.horizontal(deviceTypes, fields);
			console.log(output);
		}
	}
}
