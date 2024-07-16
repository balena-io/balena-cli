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

import { ExpectedError } from '../../errors.js';
import { stripIndent } from '../lazy.js';

import type { SshRemoteCommandOpts } from '../ssh.js';
import {
	findBestUsernameForDevice,
	getRemoteCommandOutput,
	runRemoteCommand,
} from '../ssh.js';

export interface DeviceSSHOpts extends SshRemoteCommandOpts {
	forceTTY?: boolean;
	service?: string;
}

const deviceContainerEngineBinary = `$(if [ -f /usr/bin/balena ]; then echo "balena"; else echo "docker"; fi)`;

/**
 * List the running containers on the device over ssh, and return the full
 * container name that matches the given service name.
 *
 * Note: In the past, two other approaches were implemented for this function:
 *
 *   - Obtaining container IDs through a supervisor API call:
 *     '/supervisor/v2/containerId' endpoint, via cloud.
 *   - Obtaining container IDs using 'dockerode' connected directly to
 *     balenaEngine on a device, TCP port 2375.
 *
 * The problem with using the supervisor API is that it means that 'balena ssh'
 * becomes dependent on the supervisor being up an running, but sometimes ssh
 * is needed to investigate devices issues where the supervisor has got into
 * trouble (e.g. supervisor in restart loop). This is the subject of CLI issue
 * https://github.com/balena-io/balena-cli/issues/1560 .
 *
 * The problem with using dockerode to connect directly to port 2375 (balenaEngine)
 * is that it only works with development variants of balenaOS. Production variants
 * block access to port 2375 for security reasons. 'balena ssh' should support
 * production variants as well, especially after balenaOS v2.44.0 that introduced
 * support for using the cloud account username for ssh authentication.
 *
 * Overall, the most reliable approach is to run 'balena-engine ps' over ssh.
 * It is OK to depend on balenaEngine because ssh to a container is implemented
 * through 'balena-engine exec' anyway, and of course it is OK to depend on ssh
 * itself.
 */
export async function getContainerIdForService(
	opts: SshRemoteCommandOpts & { service: string; deviceUuid?: string },
): Promise<string> {
	opts.cmd = `"${deviceContainerEngineBinary}" ps --format "{{.ID}} {{.Names}}"`;
	if (opts.deviceUuid) {
		// If a device UUID is given, perform ssh via cloud proxy 'host' command
		opts.cmd = `host ${opts.deviceUuid} ${opts.cmd}`;
	}

	const psLines: string[] = (
		await getRemoteCommandOutput({ ...opts, stderr: 'inherit' })
	).stdout
		.toString()
		.split('\n')
		.filter((l) => l);

	const { escapeRegExp } = await import('lodash');
	const regex = new RegExp(`(?:^|\\/)${escapeRegExp(opts.service)}_\\d+_\\d+`);
	// Old balenaOS container name pattern:
	//    main_1234567_2345678
	// New balenaOS container name patterns:
	//    main_1234567_2345678_a000b111c222d333e444f555a666b777
	//    main_1_1_localrelease
	const nameRegex = /(?:^|\/)([a-zA-Z0-9_-]+)_\d+_\d+(?:_.+)?$/;

	const serviceNames: string[] = [];
	const containerNames: string[] = [];
	let containerId: string | undefined;

	// sample psLine: 'b603c74e951e bar_4587562_2078151_3261c9d4c22f2c53a5267be459c89990'
	for (const psLine of psLines) {
		const [cId, name] = psLine.split(' ');
		if (cId && name) {
			if (regex.test(name)) {
				containerNames.push(name);
				containerId = cId;
			}
			const match = name.match(nameRegex);
			if (match) {
				serviceNames.push(match[1]);
			}
		}
	}

	if (containerNames.length > 1) {
		const [s, d] = [opts.service, opts.deviceUuid || opts.hostname];
		throw new ExpectedError(stripIndent`
			Found more than one container matching service name "${s}" on device "${d}":
			${containerNames.join(', ')}
			Use different service names to avoid ambiguity.
		`);
	}
	if (!containerId) {
		const [s, d] = [opts.service, opts.deviceUuid || opts.hostname];
		throw new ExpectedError(
			`Could not find a container matching service name "${s}" on device "${d}".${
				serviceNames.length > 0
					? `\nAvailable services:\n\t${serviceNames.join('\n\t')}`
					: ''
			}`,
		);
	}
	return containerId;
}

export async function performLocalDeviceSSH(
	opts: DeviceSSHOpts,
): Promise<void> {
	// Before we started using `findBestUsernameForDevice`, we tried the approach
	// of attempting ssh with the 'root' username first and, if that failed, then
	// attempting ssh with a regular user (balenaCloud username). The problem with
	// that approach was that it would print the following message to the console:
	//     "root@192.168.1.36: Permission denied (publickey)"
	// ... right before having success as a regular user, which looked broken or
	// confusing from users' point of view.  Capturing stderr to prevent that
	// message from being printed is tricky because the messages printed to stderr
	// may include the stderr output of remote commands that are of interest to
	// the user.
	const username = await findBestUsernameForDevice(opts.hostname, opts.port);
	let cmd = '';

	if (opts.service) {
		const containerId = await getContainerIdForService({
			...opts,
			service: opts.service,
			username,
		});

		const shellCmd = `/bin/sh -c "if [ -e /bin/bash ]; then exec /bin/bash; else exec /bin/sh; fi"`;
		// stdin (fd=0) is not a tty when data is piped in, for example
		// echo 'ls -la; exit;' | balena ssh 192.168.0.20 service1
		// See https://www.balena.io/blog/balena-monthly-roundup-january-2020/#charliestipsntricks
		//     https://assets.balena.io/newsletter/2020-01/pipe.png
		const isTTY = !!opts.forceTTY || (await import('tty')).isatty(0);
		const ttyFlag = isTTY ? '-t' : '';
		cmd = `${deviceContainerEngineBinary} exec -i ${ttyFlag} ${containerId} ${shellCmd}`;
	}

	await runRemoteCommand({ ...opts, cmd, username });
}
