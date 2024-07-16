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
import { getBalenaSdk, getCliUx, stripIndent } from '../../utils/lazy.js';
import type {
	BalenaSDK,
	DeviceWithServiceDetails,
	CurrentServiceWithCommit,
} from 'balena-sdk';

export default class DeviceRestartCmd extends Command {
	public static description = stripIndent`
		Restart containers on a device.

		Restart containers on a device.
		If the --service flag is provided, then only those services' containers
		will be restarted, otherwise all containers on the device will be restarted.

		Multiple devices and services may be specified with a comma-separated list
		of values (no spaces).

		Note this does not reboot the device, to do so use instead \`balena device reboot\`.
		`;
	public static examples = [
		'$ balena device restart 23c73a1',
		'$ balena device restart 55d43b3,23c73a1',
		'$ balena device restart 23c73a1 --service myService',
		'$ balena device restart 23c73a1 -s myService1,myService2',
	];

	public static args = {
		uuid: Args.string({
			description:
				'comma-separated list (no blank spaces) of device UUIDs to restart',
			required: true,
		}),
	};

	public static usage = 'device restart <uuid>';

	public static flags = {
		service: Flags.string({
			description:
				'comma-separated list (no blank spaces) of service names to restart',
			char: 's',
		}),
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(DeviceRestartCmd);

		const balena = getBalenaSdk();
		const ux = getCliUx();

		const deviceUuids = params.uuid.split(',');
		const serviceNames = options.service?.split(',');

		// Iterate sequentially through deviceUuids.
		// We may later want to add a batching feature,
		// so that n devices are processed in parallel
		for (const uuid of deviceUuids) {
			ux.action.start(`Restarting services on device ${uuid}`);
			if (serviceNames) {
				await this.restartServices(balena, uuid, serviceNames);
			} else {
				await this.restartAllServices(balena, uuid);
			}
			ux.action.stop();
		}
	}

	async restartServices(
		balena: BalenaSDK,
		deviceUuid: string,
		serviceNames: string[],
	) {
		const { ExpectedError, instanceOf } = await import('../../errors.js');
		const { getExpandedProp } = await import('../../utils/pine.js');

		// Get device
		let device: DeviceWithServiceDetails<CurrentServiceWithCommit>;
		try {
			device = await balena.models.device.getWithServiceDetails(deviceUuid, {
				$expand: {
					is_running__release: { $select: 'commit' },
				},
			});
		} catch (e) {
			const { BalenaDeviceNotFound } = await import('balena-errors');
			if (instanceOf(e, BalenaDeviceNotFound)) {
				throw new ExpectedError(`Device ${deviceUuid} not found.`);
			} else {
				throw e;
			}
		}

		const activeRelease = getExpandedProp(device.is_running__release, 'commit');

		// Check specified services exist on this device before restarting anything
		serviceNames.forEach((service) => {
			if (!device.current_services[service]) {
				throw new ExpectedError(
					`Service ${service} not found on device ${deviceUuid}.`,
				);
			}
		});

		// Restart services
		const restartPromises: Array<Promise<void>> = [];
		for (const serviceName of serviceNames) {
			const service = device.current_services[serviceName];
			// Each service is an array of `CurrentServiceWithCommit`
			// because when service is updating, it will actually hold 2 services
			// Target commit matching `device.is_running__release`
			const serviceContainer = service.find((s) => {
				return s.commit === activeRelease;
			});

			if (serviceContainer) {
				restartPromises.push(
					balena.models.device.restartService(
						deviceUuid,
						serviceContainer.image_id,
					),
				);
			}
		}

		try {
			await Promise.all(restartPromises);
		} catch (e) {
			if (e.message.toLowerCase().includes('no online device')) {
				throw new ExpectedError(`Device ${deviceUuid} is not online.`);
			} else {
				throw e;
			}
		}
	}

	async restartAllServices(balena: BalenaSDK, deviceUuid: string) {
		// Note: device.restartApplication throws `BalenaDeviceNotFound: Device not found` if device not online.
		// Need to use device.get first to distinguish between non-existant and offline devices.
		// Remove this workaround when SDK issue resolved: https://github.com/balena-io/balena-sdk/issues/649
		const { instanceOf, ExpectedError } = await import('../../errors.js');
		try {
			const device = await balena.models.device.get(deviceUuid);
			if (!device.is_online) {
				throw new ExpectedError(`Device ${deviceUuid} is not online.`);
			}
		} catch (e) {
			const { BalenaDeviceNotFound } = await import('balena-errors');
			if (instanceOf(e, BalenaDeviceNotFound)) {
				throw new ExpectedError(`Device ${deviceUuid} not found.`);
			} else {
				throw e;
			}
		}

		await balena.models.device.restartApplication(deviceUuid);
	}
}
