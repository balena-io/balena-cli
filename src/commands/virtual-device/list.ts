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

import { Command } from '@oclif/core';
import { formatDistanceToNow } from 'date-fns';
import { defaultValues } from '../../utils/helpers';
import { getVisuals, stripIndent } from '../../utils/lazy';
import type { VirtInstance } from '../../utils/virtual-device/types';
import { extractInstanceId } from '../../utils/virtual-device';

export default class VirtualDeviceListCmd extends Command {
	public static enableJsonFlag = true;

	public static description = stripIndent`
		List running virtual devices.

		List all running virtual balenaOS device instances with their
		SSH connection details and status.

		This command is useful when running virtual devices in detached mode
		(started with 'balena virt start --detached'). In interactive mode,
		press Ctrl+C to stop the VM directly.
	`;

	public static examples = [
		'$ balena virtual-device list',
		'$ balena virt list',
		'$ balena virtual-device list --json',
	];

	public static flags = {};

	public static primary = true;

	public async run() {
		const { flags: options } = await this.parse(VirtualDeviceListCmd);

		const { listContainers } = await import('../../utils/virtual-device');

		const instances = await listContainers();

		if (instances.length === 0) {
			if (options.json) {
				return JSON.stringify([], null, 4);
			}
			console.log('No virtual devices running.');
			console.log('\nTo start a virtual device:');
			console.log('  balena virtual-device start --image <path-to-balena.img>');
			return;
		}

		// Map instances to display format
		const displayInstances = instances.map((instance: VirtInstance) => ({
			id: extractInstanceId(instance.name),
			name: instance.name,
			ssh_port: instance.sshPort,
			status: instance.status,
			created: formatDistanceToNow(new Date(instance.created), {
				addSuffix: true,
			}),
			ssh_command: `ssh root@localhost -p ${instance.sshPort}`,
		}));

		const fields = [
			'id',
			'ssh_port',
			'status',
			'created',
			'ssh_command',
		] as const;

		if (options.json) {
			return JSON.stringify(displayInstances, null, 4);
		}

		console.log(
			getVisuals().table.horizontal(
				displayInstances.map((inst) => defaultValues(inst, 'N/a')),
				[...fields],
			),
		);
	}
}
