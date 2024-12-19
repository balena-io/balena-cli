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
import { Flags, Command } from '@oclif/core';
import type * as BalenaSdk from 'balena-sdk';
import _ from 'lodash';
import { getBalenaSdk, getVisuals, stripIndent } from '../../utils/lazy.js';

export default class DeviceTypeListCmd extends Command {
	public static aliases = ['devices supported'];
	public static deprecateAliases = true;

	public static description = stripIndent`
		List the device types supported by balena (like 'raspberrypi3' or 'intel-nuc').

		List the device types supported by balena (like 'raspberrypi3' or 'intel-nuc').

		By default, only actively supported device types are listed.
		The --all option can be used to list all device types, including those that are
		no longer supported by balena.

		The --json option is recommended when scripting the output of this command,
		because the JSON format is less likely to change and it better represents data
		types like lists and empty strings (for example, the ALIASES column contains a
		list of zero or more values). The 'jq' utility may be helpful in shell scripts
		(https://stedolan.github.io/jq/manual/).
`;
	public static examples = [
		'$ balena device-type list',
		'$ balena device-type list --all',
		'$ balena device-type list --json',
	];

	public static flags = {
		json: Flags.boolean({
			char: 'j',
			description: 'produce JSON output instead of tabular output',
		}),
		all: Flags.boolean({
			description: 'include device types no longer supported by balena',
			default: false,
		}),
	};

	public async run() {
		const { flags: options } = await this.parse(DeviceTypeListCmd);
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
		const dts = (
			options.all
				? await getBalenaSdk().models.deviceType.getAll(pineOptions)
				: await getBalenaSdk().models.deviceType.getAllSupported(pineOptions)
		) as Array<
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
