/**
 * @license
 * Copyright 2026 Balena Ltd.
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

import { Flags, Args, Command } from '@oclif/core';
import { ExpectedError } from '../../errors';
import { stripIndent } from '../../utils/lazy';
import { extractInstanceId } from '../../utils/virtual-device';

export default class VirtualDeviceStopCmd extends Command {
	public static description = stripIndent`
		Stop a running virtual device.

		Stop one or all running virtual balenaOS device instances.
		The container and working copy are preserved, allowing you to restart
		the VM later with 'balena virt start <instance>'.

		To permanently remove a stopped VM and clean up its working copy,
		use 'balena virt rm <instance>'.

		You can specify the instance by:
		  - Full container name (e.g., balenaos-vm-1-1234567890)
		  - Instance number (e.g., 1)
		  - Container ID

		Use --all to stop all running instances at once.
	`;

	public static examples = [
		'$ balena virtual-device stop 1',
		'$ balena virt stop 1',
		'$ balena virtual-device stop balenaos-vm-1-1234567890',
		'$ balena virtual-device stop --all',
	];

	public static args = {
		instance: Args.string({
			description: 'Name, number, or ID of the virtual device instance to stop',
			required: false,
		}),
	};

	public static flags = {
		all: Flags.boolean({
			description: 'Stop all running virtual device instances',
			exclusive: ['instance'],
		}),
	};

	public async run() {
		const { args: params, flags: options } =
			await this.parse(VirtualDeviceStopCmd);

		if (!params.instance && !options.all) {
			throw new ExpectedError(
				'You must specify an instance name/number or use --all to stop all instances.\n\n' +
					'Usage:\n' +
					'  balena virtual-device stop <instance>  Stop a specific instance\n' +
					'  balena virtual-device stop --all       Stop all instances\n\n' +
					'Run "balena virtual-device list" to see running instances.',
			);
		}

		const { findContainer, stopContainer, listContainers } = await import(
			'../../utils/virtual-device'
		);

		if (options.all) {
			// Stop all running instances
			const instances = await listContainers();
			const running = instances.filter((i) => i.status === 'running');

			if (running.length === 0) {
				console.log('No running virtual devices to stop.');
				return;
			}

			console.log(`Stopping ${running.length} virtual device(s)...`);

			let stoppedCount = 0;
			for (const instance of running) {
				try {
					await stopContainer(instance.containerId);
					stoppedCount++;
				} catch {
					// Continue with other containers
				}
			}

			console.log(`\nStopped ${stoppedCount} virtual device(s).`);
			console.log('Use "balena virt rm --all" to clean up stopped instances.');
		} else {
			// Stop a specific instance
			const identifier = params.instance!;

			const { instance } = await findContainer(identifier);

			if (!instance) {
				throw new ExpectedError(
					`Virtual device not found: ${identifier}\n\n` +
						'Run "balena virtual-device list" to see instances.',
				);
			}

			if (instance.status !== 'running') {
				console.log(`Virtual device ${instance.name} is already stopped.`);
				return;
			}

			console.log(`Stopping virtual device: ${instance.name}...`);
			await stopContainer(instance.containerId);

			const instanceId = extractInstanceId(instance.name);
			console.log(`\nStopped virtual device: ${instance.name}`);
			console.log(
				`The VM can be restarted with: balena virt start ${instanceId}`,
			);
			console.log(`To remove and clean up: balena virt rm ${instanceId}`);
		}
	}
}
