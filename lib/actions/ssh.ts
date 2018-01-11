/*
Copyright 2016-2017 Resin.io

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

import { CommandDefinition } from 'capitano';
import * as commandOptions from './command-options';

export = <CommandDefinition<
	{
		uuid?: string;
	},
	{
		port?: number;
		host?: boolean;
		verbose?: boolean;
		noproxy?: boolean;
	}
>>{
	signature: 'ssh [uuid]',
	description: '(beta) get a shell into the running app container of a device',
	help: `\
Warning: 'resin ssh' requires an openssh-compatible client to be correctly
installed in your shell environment. For more information (including Windows
support) please check the README here: https://github.com/resin-io/resin-cli

Use this command to get a shell into the running application container of
your device.

Examples:

	$ resin ssh MyApp
	$ resin ssh 7cf02a6
	$ resin ssh 7cf02a6 --port 8080
	$ resin ssh 7cf02a6 -v
	$ resin ssh 7cf02a6 -s\
`,
	permission: 'user',
	primary: true,
	options: [
		{
			signature: 'port',
			parameter: 'port',
			description: 'ssh gateway port',
			alias: 'p',
		},
		{
			signature: 'verbose',
			boolean: true,
			description: 'increase verbosity',
			alias: 'v',
		},
		commandOptions.hostOSAccess,
		{
			signature: 'noproxy',
			boolean: true,
			description: `don't use the proxy configuration for this connection. \
Only makes sense if you've configured proxy globally.`,
		},
	],
	async action(params, options, done) {
		const childProcess = await import('child_process');
		const Bluebird = await import('bluebird');
		const resin = (await import('resin-sdk')).fromSharedOptions();
		const _ = await import('lodash');
		const bash = await import('bash');
		const hasbin = await import('hasbin');

		// hasbin ignores the error-first convention, so we can't promisify automatically
		const hasbinAsync = (bin: string) =>
			new Promise<boolean>(resolve => hasbin(bin, resolve));

		const { getSubShellCommand } = await import('../utils/helpers');
		const patterns = await import('../utils/patterns');

		if (options.port == null) {
			options.port = 22;
		}

		const verbose = options.verbose ? '-vvv' : '';

		const proxyConfig = global.PROXY_CONFIG;
		const useProxy = !!proxyConfig && !options.noproxy;

		const getSshProxyCommand = function(hasTunnelBin: boolean) {
			if (!useProxy) {
				return '';
			}

			if (!hasTunnelBin) {
				console.warn(`\
Proxy is enabled but the \`proxytunnel\` binary cannot be found.
Please install it if you want to route the \`resin ssh\` requests through the proxy.
Alternatively you can pass \`--noproxy\` param to the \`resin ssh\` command to ignore the proxy config
for the \`ssh\` requests.

Attempting the unproxied request for now.\
`);
				return '';
			}

			const tunnelOptions = {
				proxy: `${proxyConfig!.host}:${proxyConfig!.port}`,
				dest: '%h:%p',
			};
			const { proxyAuth } = proxyConfig!;
			if (proxyAuth) {
				const i = proxyAuth.indexOf(':');
				_.assign(tunnelOptions, {
					user: proxyAuth.substring(0, i),
					pass: proxyAuth.substring(i + 1),
				});
			}
			const proxyCommand = `proxytunnel ${bash.args(tunnelOptions, '--', '=')}`;
			return `-o ${bash.args({ ProxyCommand: proxyCommand }, '', '=')}`;
		};

		const uuidExists =
			params.uuid && (await resin.models.device.has(params.uuid));
		const selectedUuid = uuidExists
			? params.uuid!
			: await patterns.inferOrSelectDevice();

		console.info(`Connecting to: ${selectedUuid}`);
		const device = await resin.models.device.get(selectedUuid, {});
		if (!device.is_online) {
			throw new Error('Device is not online');
		}

		const {
			username,
			uuid,
			containerId,
			proxyUrl,
			hasTunnelBin,
		} = await Bluebird.props({
			username: resin.auth.whoami(),
			uuid: device.uuid,
			// get full uuid
			containerId: options.host
				? ''
				: resin.models.device
						.getApplicationInfo(device.uuid)
						.get('containerId'),
			proxyUrl: resin.settings.get('proxyUrl'),
			hasTunnelBin: useProxy ? await hasbinAsync('proxytunnel') : false,
		});

		if (containerId == null) {
			throw new Error('Did not find running application container');
		}

		const sshProxyCommand = getSshProxyCommand(hasTunnelBin);
		const accessCommand = options.host
			? `host ${uuid}`
			: `enter ${uuid} ${containerId}`;

		const command = `ssh ${verbose} -t \
-o LogLevel=ERROR \
-o StrictHostKeyChecking=no \
-o UserKnownHostsFile=/dev/null \
${sshProxyCommand} \
-p ${options.port} ${username}@ssh.${proxyUrl} ${accessCommand}`;

		const subShellCommand = getSubShellCommand(command);
		childProcess.spawn(subShellCommand.program, subShellCommand.args, {
			stdio: 'inherit',
		});
		done();
	},
};
