/*
Copyright 2016-2019 Balena

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
import { ContainerInfo } from 'dockerode';

export interface DeviceSSHOpts {
	address: string;
	port?: number;
	verbose: boolean;
	service?: string;
}

export const deviceContainerEngineBinary = `$(if [ -f /usr/bin/balena ]; then echo "balena"; else echo "docker"; fi)`;

export async function performLocalDeviceSSH(
	opts: DeviceSSHOpts,
): Promise<void> {
	const childProcess = await import('child_process');
	const reduce = await import('lodash/reduce');
	const { getSubShellCommand } = await import('../helpers');
	const { exitWithExpectedError } = await import('../patterns');
	const { stripIndent } = await import('common-tags');
	const os = await import('os');

	let command = '';

	if (opts.service != null) {
		// Get the containers which are on-device. Currently we
		// are single application, which means we can assume any
		// container which fulfills the form of
		// $serviceName_$appId_$releaseId is what we want. Once
		// we have multi-app, we should show a dialog which
		// allows the user to choose the correct container

		const Docker = await import('dockerode');
		const escapeRegex = await import('lodash/escapeRegExp');
		const docker = new Docker({
			host: opts.address,
			port: 2375,
		});

		const regex = new RegExp(`\\/?${escapeRegex(opts.service)}_\\d+_\\d+`);
		const nameRegex = /\/?([a-zA-Z0-9_]+)_\d+_\d+/;
		let allContainers: ContainerInfo[];
		try {
			allContainers = await docker.listContainers();
		} catch (_e) {
			exitWithExpectedError(stripIndent`
				Could not access docker daemon on device ${opts.address}.
				Please ensure the device is in local mode.`);
			return;
		}

		const serviceNames: string[] = [];
		const containers = allContainers
			.map(container => {
				for (const name of container.Names) {
					if (regex.test(name)) {
						return { id: container.Id, name };
					}
					const match = name.match(nameRegex);
					if (match) {
						serviceNames.push(match[1]);
					}
				}
				return;
			})
			.filter(c => c != null);

		if (containers.length === 0) {
			exitWithExpectedError(
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
			exitWithExpectedError(stripIndent`
				Found more than one container with a service name ${opts.service}.
				This state is not supported, please contact support.
			`);
		}

		// Getting a command to work on all platforms is a pain,
		// so we just define slightly different ones for windows
		if (os.platform() !== 'win32') {
			const shellCmd = `/bin/sh -c "if [ -e /bin/bash ]; then exec /bin/bash; else exec /bin/sh; fi"`;
			command = `'${deviceContainerEngineBinary}' exec -ti ${
				containers[0]!.id
			} '${shellCmd}'`;
		} else {
			const shellCmd = `/bin/sh -c "if [ -e /bin/bash ]; then exec /bin/bash; else exec /bin/sh; fi"`;
			command = `${deviceContainerEngineBinary} exec -ti ${
				containers[0]!.id
			} ${shellCmd}`;
		}
	}
	// Generate the SSH command
	const sshCommand = `ssh \
	${opts.verbose ? '-vvv' : ''} \
	-t \
	-p ${opts.port ? opts.port : 22222} \
	-o LogLevel=ERROR \
	-o StrictHostKeyChecking=no \
	-o UserKnownHostsFile=/dev/null \
	root@${opts.address} ${command}`;

	const subShell = getSubShellCommand(sshCommand);
	childProcess.spawn(subShell.program, subShell.args, { stdio: 'inherit' });
}
