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
import * as cf from '../../utils/common-flags';
import { getBalenaSdk, stripIndent } from '../../utils/lazy';

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
	`;

	public static examples = ['$ balena os versions raspberrypi3'];

	public static args = [
		{
			name: 'type',
			description: 'device type',
			required: true,
		},
	];

	public static usage = 'os versions <type>';

	public static flags: flags.Input<FlagsDef> = {
		help: cf.help,
	};

	public async run() {
		const { args: params } = this.parse<FlagsDef, ArgsDef>(OsVersionsCmd);

		const {
			versions: vs,
			recommended,
		} = await getBalenaSdk().models.os.getSupportedVersions(params.type);

		vs.forEach((v) => {
			console.log(`v${v}` + (v === recommended ? ' (recommended)' : ''));
		});
	}
}
