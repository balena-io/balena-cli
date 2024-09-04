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

import { Flags } from '@oclif/core';
import Command from '../../command.js';
import * as cf from '../../utils/common-flags.js';
import { getCliUx, stripIndent } from '../../utils/lazy.js';

export default class ScanCmd extends Command {
	public static description = stripIndent`
		Scan for balenaOS devices on your local network.

		Scan for balenaOS devices on your local network.

		The output includes device information collected through balenaEngine for
		devices running a development image of balenaOS. Devices running a production
		image do not expose balenaEngine (on TCP port 2375), which is why less
		information is printed about them.
`;

	public static examples = [
		'$ balena scan',
		'$ balena scan --timeout 120',
		'$ balena scan --verbose',
	];

	public static usage = 'scan';

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
		help: cf.help,
		json: Flags.boolean({
			default: false,
			char: 'j',
			description: 'produce JSON output instead of tabular output',
		}),
	};

	public static primary = true;
	public static root = true;
	public static offlineCompatible = true;

	public async run() {
		const _ = await import('lodash');
		const { discoverLocalBalenaOsDevices } = await import(
			'../../utils/discover.js'
		);
		const prettyjson = await import('prettyjson');
		const dockerUtils = await import('../../utils/docker.js');

		const dockerPort = 2375;
		const dockerTimeout = 2000;

		const { flags: options } = await this.parse(ScanCmd);

		const discoverTimeout =
			options.timeout != null ? options.timeout * 1000 : undefined;

		// Find active local devices
		const ux = getCliUx();
		ux.action.start('Scanning for local balenaOS devices');

		const localDevices = await discoverLocalBalenaOsDevices(discoverTimeout);
		const engineReachableDevices: boolean[] = await Promise.all(
			localDevices.map(async ({ address }: { address: string }) => {
				const docker = await dockerUtils.createClient({
					host: address,
					port: dockerPort,
					timeout: dockerTimeout,
				});
				try {
					await docker.ping();
					return true;
				} catch (err) {
					return false;
				}
			}),
		);

		const developmentDevices = localDevices.filter(
			(_localDevice, index) => engineReachableDevices[index],
		);

		const productionDevices = _.differenceWith(
			localDevices,
			developmentDevices,
			_.isEqual,
		);

		const productionDevicesInfo = productionDevices.map((device) => {
			return {
				host: device.host,
				address: device.address,
				osVariant: 'production',
				dockerInfo: undefined,
				dockerVersion: undefined,
			};
		});

		// Query devices for info
		const devicesInfo = await Promise.all(
			developmentDevices.map(async ({ host, address }) => {
				const docker = await dockerUtils.createClient({
					host: address,
					port: dockerPort,
					timeout: dockerTimeout,
				});
				const [dockerInfo, dockerVersion] = await Promise.all([
					docker.info(),
					docker.version(),
				]);
				return {
					host,
					address,
					osVariant: 'development',
					dockerInfo,
					dockerVersion,
				};
			}),
		);

		ux.action.stop('Reporting scan results');

		// Reduce properties if not --verbose
		if (!options.verbose) {
			devicesInfo.forEach((d: any) => {
				d.dockerInfo = _.isObject(d.dockerInfo)
					? _.pick(d.dockerInfo, ScanCmd.dockerInfoProperties)
					: d.dockerInfo;
				d.dockerVersion = _.isObject(d.dockerVersion)
					? _.pick(d.dockerVersion, ScanCmd.dockerVersionProperties)
					: d.dockerVersion;
			});
		}

		const cmdOutput: Array<{
			host: string;
			address: string;
			osVariant: string;
			dockerInfo: any;
			dockerVersion: import('dockerode').DockerVersion | undefined;
		}> = [...productionDevicesInfo, ...devicesInfo];

		// Output results
		if (!options.json && cmdOutput.length === 0) {
			console.error(
				process.platform === 'win32'
					? ScanCmd.noDevicesFoundMessage + ScanCmd.windowsTipMessage
					: ScanCmd.noDevicesFoundMessage,
			);
			return;
		}
		console.log(
			options.json
				? JSON.stringify(cmdOutput, null, 4)
				: prettyjson.render(cmdOutput, { noColor: true }),
		);
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

	protected static dockerVersionProperties = ['Version', 'ApiVersion'];

	protected static noDevicesFoundMessage =
		'Could not find any balenaOS devices on the local network.';

	protected static windowsTipMessage = `

Note for Windows users:
  The 'scan' command relies on the Bonjour service. Check whether Bonjour is
  installed (Control Panel > Programs and Features). If not, you can download
  Bonjour for Windows (included with Bonjour Print Services) from here:
  https://support.apple.com/kb/DL999

  After installing Bonjour, restart your PC and run the 'balena scan' command
  again.`;
}
