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

import Command from '../../command';
import { getDeviceTypeAliases } from '../../utils/cloud';
import * as cf from '../../utils/common-flags';
import { stripIndent } from '../../utils/lazy';

interface FlagsDef {
	help: void;
}

interface ArgsDef {
	type: string;
}

export default class OsVersionsCmd extends Command {
	public static description = stripIndent`
		Show available balenaOS versions for the given device type.

		Show the available balenaOS versions for the given device type.
		Check available types with \`balena devices supported\`.

		This command also accepts device type aliases (e.g. "nuc" instead of
		"intel-nuc"), but it runs significantly slower when aliases are used.
	`;

	public static examples = ['$ balena os versions raspberrypi3'];

	public static args = [
		{
			name: 'type',
			description: 'device type',
		},
	];

	public static usage = 'os versions <type>';

	public static flags: flags.Input<FlagsDef> = {
		help: cf.help,
	};

	public async run() {
		const { args: params } = this.parse<FlagsDef, ArgsDef>(OsVersionsCmd);

		let versions = await this.getOsVersionsForDeviceType(params.type);
		if (versions.length === 0) {
			const aliases = await getDeviceTypeAliases();
			if (aliases[params.type]) {
				versions = await this.getOsVersionsForDeviceType(aliases[params.type]);
			}
		}
		console.log(versions.join('\n'));
	}

	protected async getOsVersionsForDeviceType(
		deviceType: string,
	): Promise<string[]> {
		const osUtils = await import('../../utils/os');
		const allVersions = await osUtils.getAllOsVersions([deviceType]);
		const versionObjects = allVersions[deviceType] || [];
		return versionObjects.map((vObj) => {
			let fv = vObj.formattedVersion;
			if (vObj.variant) {
				// Add '.dev' or '.prod', e.g. v2.38.0+rev1 -> v2.38.0+rev1.dev
				let i = fv.indexOf(' ');
				i = i < 0 ? fv.length : i;
				fv = fv.slice(0, i) + `.${vObj.variant}` + fv.slice(i);
			}
			if (vObj.osType === 'esr') {
				// Add 'ESR' to the attribute list in brackets, e.g.:
				// v2019.10.2.prod (sunset) -> v2019.10.2.prod (ESR, sunset)
				let i = fv.indexOf('(');
				if (i++ > 0) {
					fv = fv.slice(0, i) + 'ESR, ' + fv.slice(i);
				} else {
					fv += ' (ESR)';
				}
			}
			return fv;
		});
	}
}
