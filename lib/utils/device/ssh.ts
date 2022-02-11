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

import { ExpectedError } from '../../errors';
import { stripIndent } from '../lazy';

export interface DeviceSSHOpts {
	address: string;
	port?: number;
	forceTTY?: boolean;
	verbose: boolean;
	service?: string;
}

export const deviceContainerEngineBinary = `$(if [ -f /usr/bin/balena ]; then echo "balena"; else echo "docker"; fi)`;

/**
 * List the running containers on the device with dockerode, and return the
 * container ID that matches the given service name.
 */
async function getContainerIdForService(
	service: string,
	deviceAddress: string,
): Promise<string> {
	const { escapeRegExp, reduce } = await import('lodash');
	const Docker = await import('dockerode');
	const docker = new Docker({
		host: deviceAddress,
		port: 2375,
	});
	const regex = new RegExp(`(^|\\/)${escapeRegExp(service)}_\\d+_\\d+`);
	const nameRegex = /\/?([a-zA-Z0-9_-]+)_\d+_\d+/;
	let allContainers: ContainerInfo[];
	try {
		allContainers = await docker.listContainers();
	} catch (_e) {
		throw new ExpectedError(stripIndent`
			Could not access docker daemon on device ${deviceAddress}.
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
	if (containers.length > 1) {
		throw new ExpectedError(stripIndent`
			Found more than one container matching service name "${service}":
			${containers.map((container) => container.name).join(', ')}
			Use different service names to avoid ambiguity.
		`);
	}
	const containerId = containers.length ? containers[0].id : '';
	if (!containerId) {
		throw new ExpectedError(
			`Could not find a service on device with name ${service}. ${
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
	return containerId;
}

export async function performLocalDeviceSSH(
	opts: DeviceSSHOpts,
): Promise<void> {
	let cmd = '';

	if (opts.service) {
		const containerId = await getContainerIdForService(
			opts.service,
			opts.address,
		);

		const shellCmd = `/bin/sh -c "if [ -e /bin/bash ]; then exec /bin/bash; else exec /bin/sh; fi"`;
		// stdin (fd=0) is not a tty when data is piped in, for example
		// echo 'ls -la; exit;' | balena ssh 192.168.0.20 service1
		// See https://www.balena.io/blog/balena-monthly-roundup-january-2020/#charliestipsntricks
		//     https://assets.balena.io/newsletter/2020-01/pipe.png
		const isTTY = !!opts.forceTTY || (await import('tty')).isatty(0);
		const ttyFlag = isTTY ? '-t' : '';
		cmd = `${deviceContainerEngineBinary} exec -i ${ttyFlag} ${containerId} ${shellCmd}`;
	}

	const { findBestUsernameForDevice, runRemoteCommand } = await import(
		'../ssh'
	);

	// Before we started using `findBestUsernameForDevice`, we tried the approach
	// of attempting ssh with the 'root' username first and, if that failed, then
	// attempting ssh with a regular user (balenaCloud username). The problem with
	// that approach was that it would print the following message to the console:
	//     "root@192.168.1.36: Permission denied (publickey)"
	// ... right before having success as a regular user, which looked broken or
	// confusing from users' point of view.  Capturing stderr to prevent that
	// message from being printed is tricky because the messages printed to stderr
	// may include the stderr output of remote commands that are of interest to
	// the user.  Workarounds based on delays (timing) are tricky too because a
	// ssh session length may vary from a fraction of a second (non interactive)
	// to hours or days.
	const username = await findBestUsernameForDevice(opts.address);

	await runRemoteCommand({
		cmd,
		hostname: opts.address,
		port: Number(opts.port) || 'local',
		username,
		verbose: opts.verbose,
	});
}
