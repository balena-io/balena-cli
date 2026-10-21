/**
 * @license
 * Copyright 2017-2021 Balena Ltd.
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

import { Flags, Command } from '@oclif/core';
import { getCliUx, stripIndent } from '../../utils/lazy';
import { pick } from '../../utils/helpers';

export default class DeviceDetectCmd extends Command {
	public static enableJsonFlag = true;

	public static description = stripIndent`
		Scan for balenaOS devices on your local network.

		Scan for balenaOS devices on your local network.

		The output includes device information collected through balenaEngine, which
		the CLI reaches through SSH (port 22222) with your SSH agent or default keys.
		Less information is printed about devices that do not accept your SSH key,
		and their OS variant is reported as 'unknown'.
`;

	public static examples = [
		'$ balena device detect',
		'$ balena device detect --timeout 120',
		'$ balena device detect --verbose',
	];

	public static flags = {
		verbose: Flags.boolean({
			default: false,
			char: 'v',
			description: 'display full info',
		}),
		timeout: Flags.integer({
			char: 't',
			description: 'scan timeout in seconds',
		}),
	};

	public static primary = true;
	public static root = true;
	public static offlineCompatible = true;

	public async run() {
		const { discoverLocalBalenaOsDevices } =
			await import('../../utils/discover');
		const { connectToDevice } = await import('../../utils/device/connection');
		const prettyjson = await import('prettyjson');

		const engineTimeout = 2000;

		const { flags: options } = await this.parse(DeviceDetectCmd);

		const discoverTimeout =
			options.timeout != null ? options.timeout * 1000 : undefined;

		// Find active local devices
		const ux = getCliUx();
		ux.action.start('Scanning for local balenaOS devices');

		const localDevices = await discoverLocalBalenaOsDevices(discoverTimeout);

		const cmdOutput: Array<{
			host: string;
			address: string;
			osVariant: string;
			dockerInfo: any;
			dockerVersion: Partial<import('dockerode').DockerVersion> | undefined;
		}> = await Promise.all(
			localDevices.map(async ({ host, address }) => {
				let connection;
				try {
					connection = await connectToDevice(address, engineTimeout);
				} catch {
					return {
						host,
						address,
						osVariant: 'unknown',
						dockerInfo: undefined,
						dockerVersion: undefined,
					};
				}
				try {
					const [dockerInfo, dockerVersion, developmentMode] =
						await Promise.all([
							connection.docker.info(),
							connection.docker.version(),
							connection.isDevelopmentMode(),
						]);
					return {
						host,
						address,
						osVariant: developmentMode ? 'development' : 'production',
						dockerInfo: options.verbose
							? dockerInfo
							: pick(dockerInfo, DeviceDetectCmd.dockerInfoProperties),
						dockerVersion: options.verbose
							? dockerVersion
							: pick(dockerVersion, DeviceDetectCmd.dockerVersionProperties),
					};
				} finally {
					connection.close();
				}
			}),
		);

		ux.action.stop('Reporting scan results');

		// Output results
		if (!options.json && cmdOutput.length === 0) {
			console.error(
				process.platform === 'win32'
					? DeviceDetectCmd.noDevicesFoundMessage +
							DeviceDetectCmd.windowsTipMessage
					: DeviceDetectCmd.noDevicesFoundMessage,
			);
			return;
		}
		if (options.json) {
			return JSON.stringify(cmdOutput, null, 4);
		}
		console.log(prettyjson.render(cmdOutput, { noColor: true }));
	}

	protected static dockerInfoProperties = [
		'Containers',
		'ContainersRunning',
		'ContainersPaused',
		'ContainersStopped',
		'Images',
		'Driver',
		'SystemTime',
		'KernelVersion',
		'OperatingSystem',
		'Architecture',
	];

	protected static dockerVersionProperties: Array<
		keyof import('dockerode').DockerVersion
	> = ['Version', 'ApiVersion'];

	protected static noDevicesFoundMessage =
		'Could not find any balenaOS devices on the local network.';

	protected static windowsTipMessage = `

Note for Windows users:
  The 'device detect' command relies on the Bonjour service. Check whether Bonjour is
  installed (Control Panel > Programs and Features). If not, you can download
  Bonjour for Windows (included with Bonjour Print Services) from here:
  https://support.apple.com/kb/DL999

  After installing Bonjour, restart your PC and run the 'balena device detect' command
  again.`;
}
