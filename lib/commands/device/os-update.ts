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
import * as cf from '../../utils/common-flags.js';
import { getBalenaSdk, stripIndent, getCliForm } from '../../utils/lazy.js';
import type { Device } from 'balena-sdk';
import { ExpectedError } from '../../errors.js';

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
		'$ balena device os-update 23c73a1 --version 2.101.7',
		'$ balena device os-update 23c73a1 --version 2.31.0+rev1.prod',
		'$ balena device os-update 23c73a1 --include-draft',
	];

	public static args = {
		uuid: Args.string({
			description: 'the uuid of the device to update',
			required: true,
		}),
	};

	public static usage = 'device os-update <uuid>';

	public static flags = {
		version: Flags.string({
			description: 'a balenaOS version',
			exclusive: ['include-draft'],
		}),
		'include-draft': Flags.boolean({
			description: 'include pre-release balenaOS versions',
			default: false,
			exclusive: ['version'],
		}),
		yes: cf.yes,
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } =
			await this.parse(DeviceOsUpdateCmd);

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

		let includeDraft = options['include-draft'];
		if (!includeDraft && options.version != null) {
			const bSemver = await import('balena-semver');
			const parsedVersion = bSemver.parse(options.version);
			// When the user provides a draft version, we need to pass `includeDraft`
			// to the os.getSupportedOsUpdateVersions() since w/o it the results
			// will for sure not include the user provided version and the command
			// would return a "not in the Host OS update targets" error.
			includeDraft =
				parsedVersion != null && parsedVersion.prerelease.length > 0;
		}

		// Get supported OS update versions
		const hupVersionInfo = await sdk.models.os.getSupportedOsUpdateVersions(
			is_of__device_type[0].slug,
			currentOsVersion,
			{
				includeDraft,
			},
		);
		if (hupVersionInfo.versions.length === 0) {
			throw new ExpectedError(
				'There are no available Host OS update targets for this device',
			);
		}

		// Get target OS version
		let targetOsVersion = options.version;
		if (targetOsVersion != null) {
			const { normalizeOsVersion } = await import(
				'../../utils/normalization.js'
			);
			targetOsVersion = normalizeOsVersion(targetOsVersion);
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

		const patterns = await import('../../utils/patterns.js');
		// Confirm and start update
		await patterns.confirm(
			options.yes || false,
			'Host OS updates require a device restart when they complete. Are you sure you want to proceed?',
		);

		await sdk.models.device.startOsUpdate(uuid, targetOsVersion);
		await patterns.awaitDeviceOsUpdate(uuid, targetOsVersion);
	}
}
