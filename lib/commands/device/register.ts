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
import type { IArg } from '@oclif/parser/lib/args';
import Command from '../../command';
import * as cf from '../../utils/common-flags';
import * as ca from '../../utils/common-args';
import { getBalenaSdk, stripIndent } from '../../utils/lazy';
import { applicationIdInfo } from '../../utils/messages';

interface FlagsDef {
	uuid?: string;
	help: void;
}

interface ArgsDef {
	application: string;
}

export default class DeviceRegisterCmd extends Command {
	public static description = stripIndent`
		Register a device.

		Register a device to an application.

		${applicationIdInfo.split('\n').join('\n\t\t')}
	`;

	public static examples = [
		'$ balena device register MyApp',
		'$ balena device register MyApp --uuid <uuid>',
		'$ balena device register myorg/myapp --uuid <uuid>',
	];

	public static args: Array<IArg<any>> = [ca.applicationRequired];

	public static usage = 'device register <application>';

	public static flags: flags.Input<FlagsDef> = {
		uuid: flags.string({
			description: 'custom uuid',
			char: 'u',
		}),
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			DeviceRegisterCmd,
		);

		const { getApplication } = await import('../../utils/sdk');

		const balena = getBalenaSdk();

		const application = await getApplication(balena, params.application);
		const uuid = options.uuid ?? balena.models.device.generateUniqueKey();

		console.info(`Registering to ${application.app_name}: ${uuid}`);

		const result = await balena.models.device.register(application.id, uuid);

		return result && result.uuid;
	}
}
