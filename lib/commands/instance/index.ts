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
import { IArg } from '@oclif/parser/lib/args';
import Command from '../../command';
import * as cf from '../../utils/common-flags';
import { stripIndent } from '../../utils/lazy';

interface FlagsDef {
	help: void;
	v13: boolean;
}


export default class InstanceCmd extends Command {
	public static args: Array<IArg<any>> = [
		{
			name: 'provider',
			description: 'the cloud provider',
			required: true,
		},
	];


	public static description = stripIndent`
		Initialize a new cloud instance running balenaOS

		A config.json must first be generated using the 'balena config generate' command
		`;
	public static examples = ['$ balena instance init digitalocean'];

	public static usage = 'instance [COMMAND]';

	public static flags: flags.Input<FlagsDef> = {
		help: cf.help,
		v13: cf.v13,
	};

	public static authenticated = true;
	public static primary = true;

	public async run() {
		
	}
}
