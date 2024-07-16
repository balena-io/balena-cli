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

import { Args } from '@oclif/core';
import Command from '../../command.js';
import * as cf from '../../utils/common-flags.js';
import { getBalenaSdk, getCliUx, stripIndent } from '../../utils/lazy.js';
import type { BalenaSDK } from 'balena-sdk';

export default class DeviceStartServiceCmd extends Command {
	public static description = stripIndent`
		Start containers on a device.

		Start containers on a device.

		Multiple devices and services may be specified with a comma-separated list
		of values (no spaces).
		`;
	public static examples = [
		'$ balena device start-service 23c73a1 myService',
		'$ balena device start-service 23c73a1 myService1,myService2',
	];

	public static args = {
		uuid: Args.string({
			description: 'comma-separated list (no blank spaces) of device UUIDs',
			required: true,
		}),
		service: Args.string({
			description: 'comma-separated list (no blank spaces) of service names',
			required: true,
		}),
	};

	public static usage = 'device start-service <uuid>';

	public static flags = {
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = await this.parse(DeviceStartServiceCmd);

		const balena = getBalenaSdk();
		const ux = getCliUx();

		const deviceUuids = params.uuid.split(',');
		const serviceNames = params.service.split(',');

		// Iterate sequentially through deviceUuids.
		// We may later want to add a batching feature,
		// so that n devices are processed in parallel
		for (const uuid of deviceUuids) {
			ux.action.start(`Starting services on device ${uuid}`);
			await this.startServices(balena, uuid, serviceNames);
			ux.action.stop();
		}
	}

	async startServices(
		balena: BalenaSDK,
		deviceUuid: string,
		serviceNames: string[],
	) {
		const { ExpectedError } = await import('../../errors.js');
		const { getExpandedProp } = await import('../../utils/pine.js');

		// Get device
		const device = await balena.models.device.getWithServiceDetails(
			deviceUuid,
			{
				$expand: {
					is_running__release: { $select: 'commit' },
				},
			},
		);

		const activeReleaseCommit = getExpandedProp(
			device.is_running__release,
			'commit',
		);

		// Check specified services exist on this device before startinganything
		serviceNames.forEach((service) => {
			if (!device.current_services[service]) {
				throw new ExpectedError(
					`Service ${service} not found on device ${deviceUuid}.`,
				);
			}
		});

		// Start services
		const startPromises: Array<Promise<void>> = [];
		for (const serviceName of serviceNames) {
			const service = device.current_services[serviceName];
			// Each service is an array of `CurrentServiceWithCommit`
			// because when service is updating, it will actually hold 2 services
			// Target commit matching `device.is_running__release`
			const serviceContainer = service.find((s) => {
				return s.commit === activeReleaseCommit;
			});

			if (serviceContainer) {
				startPromises.push(
					balena.models.device.startService(
						deviceUuid,
						serviceContainer.image_id,
					),
				);
			}
		}

		try {
			await Promise.all(startPromises);
		} catch (e) {
			if (e.message.toLowerCase().includes('no online device')) {
				throw new ExpectedError(`Device ${deviceUuid} is not online.`);
			} else {
				throw e;
			}
		}
	}
}
