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

export default class VirtualDeviceRmCmd extends Command {
	public static description = stripIndent`
		Remove a virtual device and clean up its working copy.

		Remove one or all virtual balenaOS device instances.
		This permanently deletes the container and its working copy image file.

		For running instances, the VM will be stopped first before removal.
		Use 'balena virt stop' if you only want to stop a VM temporarily
		(the VM can be restarted later with 'balena virt start <instance>').

		You can specify the instance by:
		  - Full container name (e.g., balenaos-vm-1-1234567890)
		  - Instance number (e.g., 1)
		  - Container ID

		Use --all to remove all instances at once.
	`;

	public static examples = [
		'$ balena virtual-device rm 1',
		'$ balena virt rm 1',
		'$ balena virtual-device rm balenaos-vm-1-1234567890',
		'$ balena virtual-device rm --all',
	];

	public static args = {
		instance: Args.string({
			description:
				'Name, number, or ID of the virtual device instance to remove',
			required: false,
		}),
	};

	public static flags = {
		all: Flags.boolean({
			description: 'Remove all virtual device instances',
			exclusive: ['instance'],
		}),
	};

	public async run() {
		const { args: params, flags: options } =
			await this.parse(VirtualDeviceRmCmd);

		if (!params.instance && !options.all) {
			throw new ExpectedError(
				'You must specify an instance name/number or use --all to remove all instances.\n\n' +
					'Usage:\n' +
					'  balena virtual-device rm <instance>  Remove a specific instance\n' +
					'  balena virtual-device rm --all       Remove all instances\n\n' +
					'Run "balena virtual-device list" to see instances.',
			);
		}

		const {
			stopContainerWithCleanup,
			stopAllContainersWithCleanup,
			listContainers,
		} = await import('../../utils/virtual-device');

		if (options.all) {
			// Remove all instances
			const instances = await listContainers();

			if (instances.length === 0) {
				console.log('No virtual devices to remove.');
				return;
			}

			console.log(`Removing ${instances.length} virtual device(s)...`);

			const result = await stopAllContainersWithCleanup();

			console.log(`\nRemoved ${result.stoppedCount} virtual device(s).`);
			if (result.cleanedCount > 0) {
				console.log(`Cleaned up ${result.cleanedCount} working copy image(s).`);
			}
		} else {
			// Remove a specific instance
			const identifier = params.instance!;

			console.log(`Removing virtual device: ${identifier}...`);

			try {
				const result = await stopContainerWithCleanup(identifier);

				console.log(`\nRemoved virtual device: ${result.name}`);
				if (!result.workingCopyRemoved) {
					console.log(
						'Note: Working copy image could not be removed automatically.',
					);
				}
			} catch (err) {
				if (err instanceof Error && err.message.includes('not found')) {
					throw new ExpectedError(
						`Virtual device not found: ${identifier}\n\n` +
							'Run "balena virtual-device list" to see instances.',
					);
				}
				throw err;
			}
		}
	}
}
