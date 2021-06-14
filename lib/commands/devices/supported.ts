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
import * as _ from 'lodash';
import Command from '../../command';

import * as cf from '../../utils/common-flags';
import { getBalenaSdk, getVisuals, stripIndent } from '../../utils/lazy';
import { CommandHelp } from '../../utils/oclif-utils';
import { isV13 } from '../../utils/version';

interface FlagsDef {
	discontinued: boolean;
	help: void;
	json?: boolean;
	verbose?: boolean;
}

const deprecatedInfo = isV13()
	? ''
	: `
The --verbose option may add extra columns/fields to the output. Currently
this includes the "STATE" column which is DEPRECATED and whose values are one
of 'new', 'released' or 'discontinued'. However, 'discontinued' device types
are only listed if the '--discontinued' option is also used, and this option
is also DEPRECATED.
`
			.split('\n')
			.join(`\n\t\t`);

export default class DevicesSupportedCmd extends Command {
	public static description = stripIndent`
		List the supported device types (like 'raspberrypi3' or 'intel-nuc').

		List the supported device types (like 'raspberrypi3' or 'intel-nuc').
		${deprecatedInfo}
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
			description: isV13()
				? 'No effect (DEPRECATED)'
				: 'include "discontinued" device types (DEPRECATED)',
		}),
		help: cf.help,
		json: flags.boolean({
			char: 'j',
			description: 'produce JSON output instead of tabular output',
		}),
		verbose: flags.boolean({
			char: 'v',
			description: isV13()
				? 'No effect (DEPRECATED)'
				: 'add extra columns in the tabular output (DEPRECATED)',
		}),
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
		const discontinuedDTs = isV13()
			? []
			: configDTs.filter((dt) => dt.state === 'DISCONTINUED');
		const discontinuedDTsBySlug = _.keyBy(discontinuedDTs, (dt) => dt.slug);
		// set of slugs from models.deviceType.getAllSupported() plus slugs of
		// discontinued device types as per models.config.getDeviceTypes()
		const slugsOfInterest = new Set([
			...Object.keys(dtsBySlug),
			...Object.keys(discontinuedDTsBySlug),
		]);
		interface DT {
			slug: string;
			aliases: string[];
			arch: string;
			state?: string; // to be removed in CLI v13
			name: string;
		}
		let deviceTypes: DT[] = [];
		for (const slug of slugsOfInterest) {
			const configDT: Partial<typeof configDTs[0]> =
				configDTsBySlug[slug] || {};
			if (configDT.state === 'DISCONTINUED' && !options.discontinued) {
				continue;
			}
			const dt: Partial<typeof dts[0]> = dtsBySlug[slug] || {};
			const aliases = (configDT.aliases || []).filter(
				(alias) => alias !== slug,
			);
			deviceTypes.push({
				slug,
				aliases: options.json ? aliases : [aliases.join(', ')],
				arch:
					(dt.is_of__cpu_architecture as any)?.[0]?.slug ||
					configDT.arch ||
					'n/a',
				// 'BETA' renamed to 'NEW'
				// https://www.flowdock.com/app/rulemotion/i-cli/threads/1svvyaf8FAZeSdG4dPJc4kHOvJU
				state: isV13()
					? undefined
					: (configDT.state || 'NEW').replace('BETA', 'NEW'),
				name: dt.name || configDT.name || 'N/A',
			});
		}
		const fields =
			options.verbose && !isV13()
				? ['slug', 'aliases', 'arch', 'state', 'name']
				: ['slug', 'aliases', 'arch', 'name'];
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
