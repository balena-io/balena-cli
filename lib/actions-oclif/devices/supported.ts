/**
 * @license
 * Copyright 2016-2019 Balena Ltd.
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
import type * as SDK from 'balena-sdk';
import * as _ from 'lodash';
import Command from '../../command';

import * as cf from '../../utils/common-flags';
import { getBalenaSdk, getVisuals, stripIndent } from '../../utils/lazy';
import { CommandHelp } from '../../utils/oclif-utils';

interface FlagsDef {
	discontinued: boolean;
	help: void;
	json?: boolean;
	verbose?: boolean;
}

export default class DevicesSupportedCmd extends Command {
	public static description = stripIndent`
		List the supported device types (like 'raspberrypi3' or 'intel-nuc').

		List the supported device types (like 'raspberrypi3' or 'intel-nuc').

		The --verbose option adds extra columns/fields to the output, including the
		"STATE" column whose values are one of 'new', 'released' or 'discontinued'.
		However, 'discontinued' device types are only listed if the '--discontinued'
		option is used.

		The --json option is recommended when scripting the output of this command,
		because the JSON format is less likely to change and it better represents data
		types like lists and empty strings (for example, the ALIASES column contains a
		list of zero or more values). The 'jq' utility may be helpful in shell scripts
		(https://stedolan.github.io/jq/manual/).
`;
	public static examples = [
		'$ balena devices supported',
		'$ balena devices supported --verbose',
		'$ balena devices supported -vj',
	];

	public static usage = (
		'devices supported ' +
		new CommandHelp({ args: DevicesSupportedCmd.args }).defaultUsage()
	).trim();

	public static flags: flags.Input<FlagsDef> = {
		discontinued: flags.boolean({
			description: 'include "discontinued" device types',
		}),
		help: cf.help,
		json: flags.boolean({
			char: 'j',
			description: 'produce JSON output instead of tabular output',
		}),
		verbose: flags.boolean({
			char: 'v',
			description:
				'add extra columns in the tabular output (ALIASES, ARCH, STATE)',
		}),
	};

	public async run() {
		const { flags: options } = this.parse<FlagsDef, {}>(DevicesSupportedCmd);
		const dts = await getBalenaSdk().models.config.getDeviceTypes();
		let deviceTypes: Array<Partial<SDK.DeviceTypeJson.DeviceType>> = dts.map(
			(d) => {
				if (d.aliases && d.aliases.length) {
					// remove aliases that are equal to the slug
					d.aliases = d.aliases.filter((alias: string) => alias !== d.slug);
					if (!options.json) {
						// stringify the aliases array with commas and spaces
						d.aliases = [d.aliases.join(', ')];
					}
				} else {
					// ensure it is always an array (for the benefit of JSON output)
					d.aliases = [];
				}
				return d;
			},
		);
		if (!options.discontinued) {
			deviceTypes = deviceTypes.filter((dt) => dt.state !== 'DISCONTINUED');
		}
		const fields = options.verbose
			? ['slug', 'aliases', 'arch', 'state', 'name']
			: ['slug', 'aliases', 'arch', 'name'];
		deviceTypes = _.sortBy(
			deviceTypes.map((d) => {
				const picked = _.pick(d, fields);
				// 'BETA' renamed to 'NEW'
				picked.state = picked.state === 'BETA' ? 'NEW' : picked.state;
				return picked;
			}),
			fields,
		);
		if (options.json) {
			console.log(JSON.stringify(deviceTypes, null, 4));
		} else {
			const visuals = getVisuals();
			const output = await visuals.table.horizontal(deviceTypes, fields);
			console.log(output);
		}
	}
}
