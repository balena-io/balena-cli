/**
 * @license
 * Copyright 2016 Balena Ltd.
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
import * as _ from 'lodash';
import Command from '../../command';
import * as cf from '../../utils/common-flags';
import { getBalenaSdk, getVisuals, stripIndent } from '../../utils/lazy';
import { CommandHelp } from '../../utils/oclif-utils';
import type { DataSetOutputOptions } from '../../framework';

import { isV14 } from '../../utils/version';

interface FlagsDef extends DataSetOutputOptions {
	help: void;
	json?: boolean;
}

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

	public static flags: flags.Input<FlagsDef> = {
		help: cf.help,
		...(isV14() ? cf.dataSetOutputFlags : { json: cf.json }),
	};

	public async run() {
		const { flags: options } = this.parse<FlagsDef, {}>(DevicesSupportedCmd);
		const [dts, configDTs] = await Promise.all([
			getBalenaSdk().models.deviceType.getAllSupported({
				$expand: { is_of__cpu_architecture: { $select: 'slug' } },
				$select: ['slug', 'name'],
			}),
			getBalenaSdk().models.config.getDeviceTypes(),
		]);
		const dtsBySlug = _.keyBy(dts, (dt) => dt.slug);
		const configDTsBySlug = _.keyBy(configDTs, (dt) => dt.slug);
		interface DT {
			slug: string;
			aliases: string[] | string;
			arch: string;
			name: string;
		}
		let deviceTypes: DT[] = [];
		for (const slug of Object.keys(dtsBySlug)) {
			const configDT: Partial<typeof configDTs[0]> =
				configDTsBySlug[slug] || {};
			const aliases = (configDT.aliases || []).filter(
				(alias) => alias !== slug,
			);
			const dt: Partial<typeof dts[0]> = dtsBySlug[slug] || {};
			deviceTypes.push({
				slug,
				aliases: options.json ? aliases : aliases.join(', '),
				arch: (dt.is_of__cpu_architecture as any)?.[0]?.slug || 'n/a',
				name: dt.name || 'N/A',
			});
		}
		const fields = ['slug', 'aliases', 'arch', 'name'];
		deviceTypes = _.sortBy(deviceTypes, fields);

		if (isV14()) {
			await this.outputData(deviceTypes, fields, options);
		} else {
			// Old output implementation
			if (options.json) {
				console.log(JSON.stringify(deviceTypes, null, 4));
			} else {
				const visuals = getVisuals();
				const output = await visuals.table.horizontal(deviceTypes, fields);
				console.log(output);
			}
		}
	}
}
