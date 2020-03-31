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
import * as BalenaSdk from 'balena-sdk';
import { CommandDefinition } from 'capitano';
import { stripIndent } from 'common-tags';

import { getBalenaSdk } from '../utils/lazy';
import { validateDotLocalUrl, validateIPAddress } from '../utils/validation';

async function getContainerId(
	sdk: BalenaSdk.BalenaSDK,
	uuid: string,
	serviceName: string,
	sshOpts: {
		port?: number;
		proxyCommand?: string[];
		proxyUrl: string;
		username: string;
	},
	version?: string,
	id?: number,
): Promise<string> {
	const semver = await import('balena-semver');

	if (version == null || id == null) {
		const device = await sdk.models.device.get(uuid, {
			$select: ['id', 'supervisor_version'],
		});
		version = device.supervisor_version;
		id = device.id;
	}

	let containerId: string | undefined;
	if (semver.gte(version, '8.6.0')) {
		const apiUrl = await sdk.settings.get('apiUrl');
		// TODO: Move this into the SDKs device model
		const request = await sdk.request.send({
			method: 'POST',
			url: '/supervisor/v2/containerId',
			baseUrl: apiUrl,
			body: {
				method: 'GET',
				deviceId: id,
			},
		});
		if (request.status !== 200) {
			throw new Error(
				`There was an error connecting to device ${uuid}, HTTP response code: ${request.status}.`,
			);
		}
		const body = request.body;
		if (body.status !== 'success') {
			throw new Error(
				`There was an error communicating with device ${uuid}.\n\tError: ${body.message}`,
			);
		}
		containerId = body.services[serviceName];
	} else {
		console.error(stripIndent`
			Using legacy method to detect container ID. This will be slow.
			To speed up this process, please update your device to an OS
			which has a supervisor version of at least v8.6.0.
		`);
		// We need to execute a balena ps command on the device,
		// and parse the output, looking for a specific
		// container
		const { child_process } = await import('mz');
		const escapeRegex = await import('lodash/escapeRegExp');
		const { which } = await import('../utils/helpers');
		const { deviceContainerEngineBinary } = await import('../utils/device/ssh');

		const sshBinary = await which('ssh');
		const sshArgs = generateVpnSshCommand({
			uuid,
			verbose: false,
			port: sshOpts.port,
			command: `host ${uuid} "${deviceContainerEngineBinary}" ps --format "{{.ID}} {{.Names}}"`,
			proxyCommand: sshOpts.proxyCommand,
			proxyUrl: sshOpts.proxyUrl,
			username: sshOpts.username,
		});

		if (process.env.DEBUG) {
			console.error(`[debug] [${sshBinary}, ${sshArgs.join(', ')}]`);
		}
		const subprocess = child_process.spawn(sshBinary, sshArgs, {
			stdio: [null, 'pipe', null],
		});
		const containers = await new Promise<string>((resolve, reject) => {
			const output: string[] = [];
			subprocess.stdout.on('data', chunk => output.push(chunk.toString()));
			subprocess.on('close', (code: number) => {
				if (code !== 0) {
					reject(
						new Error(
							`Non-zero error code when looking for service container: ${code}`,
						),
					);
				} else {
					resolve(output.join(''));
				}
			});
		});

		const lines = containers.split('\n');
		const regex = new RegExp(`\\/?${escapeRegex(serviceName)}_\\d+_\\d+`);
		for (const container of lines) {
			const [cId, name] = container.split(' ');
			if (regex.test(name)) {
				containerId = cId;
				break;
			}
		}
	}

	if (containerId == null) {
		throw new Error(
			`Could not find a service ${serviceName} on device ${uuid}.`,
		);
	}
	return containerId;
}

function generateVpnSshCommand(opts: {
	uuid: string;
	command: string;
	verbose: boolean;
	port?: number;
	username: string;
	proxyUrl: string;
	proxyCommand?: string[];
}) {
	return [
		...(opts.verbose ? ['-vvv'] : []),
		'-t',
		...['-o', 'LogLevel=ERROR'],
		...['-o', 'StrictHostKeyChecking=no'],
		...['-o', 'UserKnownHostsFile=/dev/null'],
		...(opts.proxyCommand && opts.proxyCommand.length
			? ['-o', `ProxyCommand=${opts.proxyCommand.join(' ')}`]
			: []),
		...(opts.port ? ['-p', opts.port.toString()] : []),
		`${opts.username}@ssh.${opts.proxyUrl}`,
		opts.command,
	];
}

export const ssh: CommandDefinition<
	{
		applicationOrDevice: string;
		// when Capitano converts a positional parameter (but not an option)
		// to a number, the original value is preserved with the _raw suffix
		applicationOrDevice_raw: string;
		serviceName?: string;
	},
	{
		port: string;
		service: string;
		verbose: true | undefined;
		noProxy: boolean;
	}
> = {
	signature: 'ssh <applicationOrDevice> [serviceName]',
	description: 'SSH into the host or application container of a device',
	primary: true,
	help: stripIndent`
		This command can be used to start a shell on a local or remote device.

		If a service name is not provided, a shell will be opened on the host OS.

		If an application name is provided, all online devices in the application
		will be presented, and the chosen device will then have a shell opened on
		in it's service container or host OS.

		For local devices, the IP address and .local domain name are supported.
		If the device is referenced by IP or \`.local\` address, the connection
		is initiated directly to balenaOS on port \`22222\` via an
		openssh-compatible client. Otherwise, any connection initiated remotely
		traverses the balenaCloud VPN.

		Examples:
			balena ssh MyApp

			balena ssh f49cefd
			balena ssh f49cefd my-service
			balena ssh f49cefd --port <port>

			balena ssh 192.168.0.1 --verbose
			balena ssh f49cefd.local my-service

		Warning: \`balena ssh\` requires an openssh-compatible client to be correctly
		installed in your shell environment. For more information (including Windows
		support) please check:
			https://github.com/balena-io/balena-cli/blob/master/INSTALL.md#additional-dependencies`,
	options: [
		{
			signature: 'port',
			parameter: 'port',
			description: stripIndent`
				SSH server port number (default 22222) if the target is an IP address or .local
				hostname. Otherwise, port number for the balenaCloud gateway (default 22).`,
			alias: 'p',
		},
		{
			signature: 'verbose',
			boolean: true,
			description: 'Increase verbosity',
			alias: 'v',
		},
		{
			signature: 'noproxy',
			boolean: true,
			description: 'Bypass global proxy configuration for the ssh connection',
		},
	],
	action: async (params, options) => {
		const applicationOrDevice =
			params.applicationOrDevice_raw || params.applicationOrDevice;
		const { ExpectedError } = await import('../errors');
		const { getProxyConfig, which } = await import('../utils/helpers');
		const { checkLoggedIn, getOnlineTargetUuid } = await import(
			'../utils/patterns'
		);
		const { spawnSshAndExitOnError } = await import('../utils/ssh');
		const sdk = getBalenaSdk();

		const verbose = options.verbose === true;
		const proxyConfig = getProxyConfig();
		const useProxy = !!proxyConfig && !options.noProxy;
		const port = options.port != null ? parseInt(options.port, 10) : undefined;

		// if we're doing a direct SSH connection locally...
		if (
			validateDotLocalUrl(applicationOrDevice) ||
			validateIPAddress(applicationOrDevice)
		) {
			const { performLocalDeviceSSH } = await import('../utils/device/ssh');
			return await performLocalDeviceSSH({
				address: applicationOrDevice,
				port,
				verbose,
				service: params.serviceName,
			});
		}

		// this will be a tunnelled SSH connection...
		await checkLoggedIn();
		const uuid = await getOnlineTargetUuid(sdk, applicationOrDevice);
		let version: string | undefined;
		let id: number | undefined;

		const device = await sdk.models.device.get(uuid, {
			$select: ['id', 'supervisor_version', 'is_online'],
		});
		id = device.id;
		version = device.supervisor_version;

		const [whichProxytunnel, username, proxyUrl] = await Promise.all([
			useProxy ? which('proxytunnel', false) : undefined,
			sdk.auth.whoami(),
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
				...(verbose ? ['--verbose'] : []),
			];
		};

		const proxyCommand = useProxy ? getSshProxyCommand() : undefined;

		if (username == null) {
			throw new ExpectedError(
				`Opening an SSH connection to a remote device requires you to be logged in.`,
			);
		}

		// At this point, we have a long uuid with a device
		// that we know exists and is accessible
		let containerId: string | undefined;
		if (params.serviceName != null) {
			containerId = await getContainerId(
				sdk,
				uuid,
				params.serviceName,
				{
					port,
					proxyCommand,
					proxyUrl: proxyUrl || '',
					username: username!,
				},
				version,
				id,
			);
		}

		let accessCommand: string;
		if (containerId != null) {
			accessCommand = `enter ${uuid} ${containerId}`;
		} else {
			accessCommand = `host ${uuid}`;
		}

		const command = generateVpnSshCommand({
			uuid,
			command: accessCommand,
			verbose,
			port,
			proxyCommand,
			proxyUrl: proxyUrl || '',
			username: username!,
		});

		return spawnSshAndExitOnError(command);
	},
};
