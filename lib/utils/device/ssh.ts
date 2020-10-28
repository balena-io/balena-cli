/*
Copyright 2016-2020 Balena

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
import type { ContainerInfo } from 'dockerode';
import { stripIndent } from '../lazy';

export interface DeviceSSHOpts {
	address: string;
	port?: number;
	forceTTY?: boolean;
	verbose: boolean;
	service?: string;
}

export const deviceContainerEngineBinary = `$(if [ -f /usr/bin/balena ]; then echo "balena"; else echo "docker"; fi)`;

export async function performLocalDeviceSSH(
	opts: DeviceSSHOpts,
): Promise<void> {
	const { escapeRegExp, reduce } = await import('lodash');
	const { spawnSshAndThrowOnError } = await import('../ssh');
	const { ExpectedError } = await import('../../errors');

	let command = '';

	if (opts.service != null) {
		// Get the containers which are on-device. Currently we
		// are single application, which means we can assume any
		// container which fulfills the form of
		// $serviceName_$appId_$releaseId is what we want. Once
		// we have multi-app, we should show a dialog which
		// allows the user to choose the correct container

		const Docker = await import('dockerode');
		const docker = new Docker({
			host: opts.address,
			port: 2375,
		});

		const regex = new RegExp(`(^|\\/)${escapeRegExp(opts.service)}_\\d+_\\d+`);
		const nameRegex = /\/?([a-zA-Z0-9_]+)_\d+_\d+/;
		let allContainers: ContainerInfo[];
		try {
			allContainers = await docker.listContainers();
		} catch (_e) {
			throw new ExpectedError(stripIndent`
				Could not access docker daemon on device ${opts.address}.
				Please ensure the device is in local mode.`);
		}

		const serviceNames: string[] = [];
		const containers: Array<{ id: string; name: string }> = [];
		for (const container of allContainers) {
			for (const name of container.Names) {
				if (regex.test(name)) {
					containers.push({ id: container.Id, name });
					break;
				}
				const match = name.match(nameRegex);
				if (match) {
					serviceNames.push(match[1]);
				}
			}
		}
		if (containers.length === 0) {
			throw new ExpectedError(
				`Could not find a service on device with name ${opts.service}. ${
					serviceNames.length > 0
						? `Available services:\n${reduce(
								serviceNames,
								(str, name) => `${str}\t${name}\n`,
								'',
						  )}`
						: ''
				}`,
			);
		}
		if (containers.length > 1) {
			throw new ExpectedError(stripIndent`
				Found more than one container matching service name "${opts.service}":
				${containers.map((container) => container.name).join(', ')}
				Use different service names to avoid ambiguity.
			`);
		}

		const containerId = containers[0].id;
		const shellCmd = `/bin/sh -c "if [ -e /bin/bash ]; then exec /bin/bash; else exec /bin/sh; fi"`;
		// stdin (fd=0) is not a tty when data is piped in, for example
		// echo 'ls -la; exit;' | balena ssh 192.168.0.20 service1
		// See https://www.balena.io/blog/balena-monthly-roundup-january-2020/#charliestipsntricks
		//     https://assets.balena.io/newsletter/2020-01/pipe.png
		const isTTY = !!opts.forceTTY || (await import('tty')).isatty(0);
		const ttyFlag = isTTY ? '-t' : '';
		command = `${deviceContainerEngineBinary} exec -i ${ttyFlag} ${containerId} ${shellCmd}`;
	}

	return spawnSshAndThrowOnError([
		...(opts.verbose ? ['-vvv'] : []),
		'-t',
		...['-p', opts.port ? opts.port.toString() : '22222'],
		...['-o', 'LogLevel=ERROR'],
		...['-o', 'StrictHostKeyChecking=no'],
		...['-o', 'UserKnownHostsFile=/dev/null'],
		`root@${opts.address}`,
		...(command ? [command] : []),
	]);
}
