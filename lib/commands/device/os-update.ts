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
import { getBalenaSdk, stripIndent, getCliForm } from '../../utils/lazy';
import { tryAsInteger } from '../../utils/validation';
import type { Device } from 'balena-sdk';
import { ExpectedError } from '../../errors';

interface FlagsDef {
	version?: string;
	yes: boolean;
	help: void;
}

interface ArgsDef {
	uuid: string;
}

export default class DeviceOsUpdateCmd extends Command {
	public static description = stripIndent`
		Start a Host OS update for a device.

		Start a Host OS update for a device.

		Note this command will ask for confirmation interactively.
		This can be avoided by passing the \`--yes\` option.

		Requires balenaCloud; will not work with openBalena or standalone balenaOS.
		`;
	public static examples = [
		'$ balena device os-update 23c73a1',
		'$ balena device os-update 23c73a1 --version 2.31.0+rev1.prod',
	];

	public static args: Array<IArg<any>> = [
		{
			name: 'uuid',
			description: 'the uuid of the device to update',
			parse: (dev) => tryAsInteger(dev),
			required: true,
		},
	];

	public static usage = 'device os-update <uuid>';

	public static flags: flags.Input<FlagsDef> = {
		version: flags.string({
			description: 'a balenaOS version',
		}),
		yes: cf.yes,
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			DeviceOsUpdateCmd,
		);

		const sdk = getBalenaSdk();

		// Get device info
		const { uuid, is_of__device_type, os_version, os_variant } =
			(await sdk.models.device.get(params.uuid, {
				$select: ['uuid', 'os_version', 'os_variant'],
				$expand: {
					is_of__device_type: {
						$select: 'slug',
					},
				},
			})) as DeviceWithDeviceType;

		// Get current device OS version
		const currentOsVersion = sdk.models.device.getOsVersion({
			os_version,
			os_variant,
		} as Device);
		if (!currentOsVersion) {
			throw new ExpectedError(
				'The current os version of the device is not available',
			);
		}

		// Get supported OS update versions
		const hupVersionInfo = await sdk.models.os.getSupportedOsUpdateVersions(
			is_of__device_type[0].slug,
			currentOsVersion,
		);
		if (hupVersionInfo.versions.length === 0) {
			throw new ExpectedError(
				'There are no available Host OS update targets for this device',
			);
		}

		// Get target OS version
		let targetOsVersion = options.version;
		if (targetOsVersion != null) {
			if (!hupVersionInfo.versions.includes(targetOsVersion)) {
				throw new ExpectedError(
					`The provided version ${targetOsVersion} is not in the Host OS update targets for this device`,
				);
			}
		} else {
			targetOsVersion = await getCliForm().ask({
				message: 'Target OS version',
				type: 'list',
				choices: hupVersionInfo.versions.map((version) => ({
					name:
						hupVersionInfo.recommended === version
							? `${version} (recommended)`
							: version,
					value: version,
				})),
			});
		}

		const patterns = await import('../../utils/patterns');
		// Confirm and start update
		await patterns.confirm(
			options.yes || false,
			'Host OS updates require a device restart when they complete. Are you sure you want to proceed?',
		);

		await sdk.models.device.startOsUpdate(uuid, targetOsVersion);
		await patterns.awaitDeviceOsUpdate(uuid, targetOsVersion);
	}
}
