/*
Copyright 2016-2020 Balena Ltd.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import { Device } from 'balena-sdk';
import { CommandDefinition } from 'capitano';
import { stripIndent } from 'common-tags';
import { ExpectedError } from '../errors';
import { getBalenaSdk } from '../utils/lazy';
import { normalizeUuidProp } from '../utils/normalization';
import * as commandOptions from './command-options';

// tslint:disable-next-line:no-namespace
namespace OsUpdate {
	export interface Args {
		uuid: string;
	}

	export type Options = commandOptions.OptionalOsVersionOption &
		commandOptions.YesOption;
}

export const osUpdate: CommandDefinition<OsUpdate.Args, OsUpdate.Options> = {
	signature: 'device os-update <uuid>',
	description: 'Start a Host OS update for a device',
	help: stripIndent`
		Use this command to trigger a Host OS update for a device.

		Notice this command will ask for confirmation interactively.
		You can avoid this by passing the \`--yes\` boolean option.

		Requires balenaCloud; will not work with openBalena or standalone balenaOS.

		Examples:

			$ balena device os-update 23c73a1
			$ balena device os-update 23c73a1 --version 2.31.0+rev1.prod
	`,
	options: [commandOptions.optionalOsVersion, commandOptions.yes],
	permission: 'user',
	async action(params, options) {
		normalizeUuidProp(params);
		const _ = await import('lodash');
		const sdk = getBalenaSdk();
		const patterns = await import('../utils/patterns');
		const form = await import('resin-cli-form');

		// Get device info
		const {
			uuid,
			device_type,
			os_version,
			os_variant,
		} = await sdk.models.device.get(params.uuid, {
			$select: ['uuid', 'device_type', 'os_version', 'os_variant'],
		});

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
			device_type,
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
			if (!_.includes(hupVersionInfo.versions, targetOsVersion)) {
				throw new ExpectedError(
					`The provided version ${targetOsVersion} is not in the Host OS update targets for this device`,
				);
			}
		} else {
			targetOsVersion = await form.ask({
				message: 'Target OS version',
				type: 'list',
				choices: hupVersionInfo.versions.map(version => ({
					name:
						hupVersionInfo.recommended === version
							? `${version} (recommended)`
							: version,
					value: version,
				})),
			});
		}

		// Confirm and start update
		await patterns.confirm(
			options.yes || false,
			'Host OS updates require a device restart when they complete. Are you sure you want to proceed?',
		);

		await sdk.models.device.startOsUpdate(uuid, targetOsVersion);
		await patterns.awaitDeviceOsUpdate(uuid, targetOsVersion);
	},
};
