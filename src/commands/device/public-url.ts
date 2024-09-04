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

import { Flags, Args } from '@oclif/core';
import Command from '../../command.js';
import { ExpectedError } from '../../errors.js';
import * as cf from '../../utils/common-flags.js';
import { getBalenaSdk, stripIndent } from '../../utils/lazy.js';

export default class DevicePublicUrlCmd extends Command {
	public static description = stripIndent`
		Get or manage the public URL for a device.

		This command will output the current public URL for the
		specified device.  It can also enable or disable the URL,
		or output the enabled status, using the respective options.
	`;

	public static examples = [
		'$ balena device public-url 23c73a1',
		'$ balena device public-url 23c73a1 --enable',
		'$ balena device public-url 23c73a1 --disable',
		'$ balena device public-url 23c73a1 --status',
	];

	public static args = {
		uuid: Args.string({
			description: 'the uuid of the device to manage',
			required: true,
		}),
	};

	public static usage = 'device public-url <uuid>';

	public static flags = {
		enable: Flags.boolean({
			description: 'enable the public URL',
			exclusive: ['disable', 'status'],
		}),
		disable: Flags.boolean({
			description: 'disable the public URL',
			exclusive: ['enable', 'status'],
		}),
		status: Flags.boolean({
			description: 'determine if public URL is enabled',
			exclusive: ['enable', 'disable'],
		}),
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } =
			await this.parse(DevicePublicUrlCmd);

		const balena = getBalenaSdk();

		if (options.enable) {
			// Enable public URL
			await balena.models.device.enableDeviceUrl(params.uuid);
		} else if (options.disable) {
			// Disable public URL
			await balena.models.device.disableDeviceUrl(params.uuid);
		} else if (options.status) {
			// Output bool indicating if public URL enabled
			const hasUrl = await balena.models.device.hasDeviceUrl(params.uuid);
			console.log(hasUrl);
		} else {
			// Output public URL
			try {
				const url = await balena.models.device.getDeviceUrl(params.uuid);
				console.log(url);
			} catch (e) {
				if (e.message.includes('Device is not web accessible')) {
					throw new ExpectedError(stripIndent`
					Public URL is not enabled for this device.

					To enable, use:
						balena device public-url ${params.uuid} --enable
					`);
				} else {
					throw e;
				}
			}
		}
	}
}
