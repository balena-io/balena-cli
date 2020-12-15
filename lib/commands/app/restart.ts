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
import * as ca from '../../utils/common-args';
import { getBalenaSdk, stripIndent } from '../../utils/lazy';
import { applicationIdInfo } from '../../utils/messages';

interface FlagsDef {
	help: void;
}

interface ArgsDef {
	application: string;
}

export default class AppRestartCmd extends Command {
	public static description = stripIndent`
		Restart an application.

		Restart all devices belonging to an application.

		${applicationIdInfo.split('\n').join('\n\t\t')}
	`;

	public static examples = [
		'$ balena app restart MyApp',
		'$ balena app restart myorg/myapp',
	];

	public static args = [ca.applicationRequired];

	public static usage = 'app restart <application>';

	public static flags: flags.Input<FlagsDef> = {
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = this.parse<FlagsDef, ArgsDef>(AppRestartCmd);

		const { getApplication } = await import('../../utils/sdk');

		const balena = getBalenaSdk();

		// Disambiguate application (if is a number, it could either be an ID or a numerical name)
		const application = await getApplication(balena, params.application);

		await balena.models.application.restart(application.id);
	}
}
