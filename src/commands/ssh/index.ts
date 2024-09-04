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
import { getBalenaSdk, stripIndent } from '../../utils/lazy.js';
import {
	parseAsInteger,
	validateLocalHostnameOrIp,
} from '../../utils/validation.js';

export default class SshCmd extends Command {
	public static description = stripIndent`
		Open a SSH prompt on a device's host OS or service container.

		Start a shell on a local or remote device. If a service name is not provided,
		a shell will be opened on the host OS.

		If a fleet is provided, an interactive menu will be presented for the selection
		of an online device. A shell will then be opened for the host OS or service
		container of the chosen device.

		For local devices, the IP address and .local domain name are supported.
		If the device is referenced by IP or \`.local\` address, the connection
		is initiated directly to balenaOS on port \`22222\` via an
		openssh-compatible client. Otherwise, any connection initiated remotely
		traverses the balenaCloud VPN.

		Commands may be piped to the standard input for remote execution (see examples).
		Note however that remote command execution on service containers (as opposed to
		the host OS) is not currently possible when a device UUID is used (instead of
		an IP address) because of a balenaCloud backend limitation.

		Note: \`balena ssh\` requires an openssh-compatible client to be correctly
		installed in your shell environment. For more information (including Windows
		support) please check:
			https://github.com/balena-io/balena-cli/blob/master/INSTALL.md#additional-dependencies,
	`;

	public static examples = [
		'$ balena ssh MyFleet',
		'$ balena ssh f49cefd',
		'$ balena ssh f49cefd my-service',
		'$ balena ssh f49cefd --port <port>',
		'$ balena ssh 192.168.0.1 --verbose',
		'$ balena ssh f49cefd.local my-service',
		'$ echo "uptime; exit;" | balena ssh f49cefd',
		'$ echo "uptime; exit;" | balena ssh 192.168.0.1 myService',
	];

	public static args = {
		fleetOrDevice: Args.string({
			description: 'fleet name/slug, device uuid, or address of local device',
			required: true,
		}),
		service: Args.string({
			description: 'service name, if connecting to a container',
			required: false,
			ignoreStdin: true,
		}),
	};

	public static usage = 'ssh <fleetOrDevice> [service]';

	public static flags = {
		port: Flags.integer({
			description: stripIndent`
				SSH server port number (default 22222) if the target is an IP address or .local
				hostname. Otherwise, port number for the balenaCloud gateway (default 22).`,
			char: 'p',
			parse: async (p) => parseAsInteger(p, 'port'),
		}),
		tty: Flags.boolean({
			default: false,
			description:
				'force pseudo-terminal allocation (bypass TTY autodetection for stdin)',
			char: 't',
		}),
		verbose: Flags.boolean({
			default: false,
			description: 'increase verbosity',
			char: 'v',
		}),
		noproxy: Flags.boolean({
			default: false,
			description: 'bypass global proxy configuration for the ssh connection',
		}),
		help: cf.help,
	};

	public static primary = true;
	public static offlineCompatible = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(SshCmd);

		// Local connection
		if (validateLocalHostnameOrIp(params.fleetOrDevice)) {
			const { performLocalDeviceSSH } = await import(
				'../../utils/device/ssh.js'
			);
			return await performLocalDeviceSSH({
				hostname: params.fleetOrDevice,
				port: options.port || 'local',
				forceTTY: options.tty,
				verbose: options.verbose,
				service: params.service,
			});
		}

		// Remote connection
		const { getProxyConfig } = await import('../../utils/helpers.js');
		const { getOnlineTargetDeviceUuid } = await import(
			'../../utils/patterns.js'
		);
		const sdk = getBalenaSdk();

		const proxyConfig = getProxyConfig();
		const useProxy = !!proxyConfig && !options.noproxy;

		// this will be a tunnelled SSH connection...
		await Command.checkNotUsingOfflineMode();
		await Command.checkLoggedIn();
		const deviceUuid = await getOnlineTargetDeviceUuid(
			sdk,
			params.fleetOrDevice,
		);

		const { which } = await import('../../utils/which.js');

		const [whichProxytunnel, { username }, proxyUrl] = await Promise.all([
			useProxy ? which('proxytunnel', false) : undefined,
			sdk.auth.getUserInfo(),
			// note that `proxyUrl` refers to the balenaCloud "resin-proxy"
			// service, currently "balena-devices.com", rather than some
			// local proxy server URL
			sdk.settings.get('proxyUrl'),
		]);

		const getSshProxyCommand = () => {
			if (!proxyConfig) {
				return;
			}
			if (!whichProxytunnel) {
				console.warn(stripIndent`
					Proxy is enabled but the \`proxytunnel\` binary cannot be found.
					Please install it if you want to route the \`balena ssh\` requests through the proxy.
					Alternatively you can pass \`--noproxy\` param to the \`balena ssh\` command to ignore the proxy config
					for the \`ssh\` requests.

					Attempting the unproxied request for now.`);
				return;
			}

			const p = proxyConfig;
			if (p.username && p.password) {
				// proxytunnel understands these variables for proxy authentication.
				// Setting the variables instead of command-line options avoids the
				// need for shell-specific escaping of special characters like '$'.
				process.env.PROXYUSER = p.username;
				process.env.PROXYPASS = p.password;
			}

			return [
				'proxytunnel',
				`--proxy=${p.host}:${p.port}`,
				// ssh replaces these %h:%p variables in the ProxyCommand option
				// https://linux.die.net/man/5/ssh_config
				'--dest=%h:%p',
				...(options.verbose ? ['--verbose'] : []),
			];
		};

		const proxyCommand = useProxy ? getSshProxyCommand() : undefined;

		// At this point, we have a long uuid of a device
		// that we know exists and is accessible
		let containerId: string | undefined;
		if (params.service != null) {
			const { getContainerIdForService } = await import(
				'../../utils/device/ssh.js'
			);
			containerId = await getContainerIdForService({
				deviceUuid,
				hostname: `ssh.${proxyUrl}`,
				port: options.port || 'cloud',
				proxyCommand,
				service: params.service,
				username,
			});
		}

		let accessCommand: string;
		if (containerId != null) {
			accessCommand = `enter ${deviceUuid} ${containerId}`;
		} else {
			accessCommand = `host ${deviceUuid}`;
		}
		const { runRemoteCommand } = await import('../../utils/ssh.js');
		await runRemoteCommand({
			cmd: accessCommand,
			hostname: `ssh.${proxyUrl}`,
			port: options.port || 'cloud',
			proxyCommand,
			username,
			verbose: options.verbose,
		});
	}
}
