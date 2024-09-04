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
import { stripIndent } from '../../utils/lazy.js';

export default class OsDownloadCmd extends Command {
	public static description = stripIndent`
		Download an unconfigured OS image.

		Download an unconfigured OS image for the specified device type.
		Check available device types with 'balena devices supported'.

		Note: Currently this command only works with balenaCloud, not openBalena.
		If using openBalena, please download the OS from: https://www.balena.io/os/

		The '--version' option is used to select the balenaOS version. If omitted,
		the latest released version is downloaded (and if only pre-release versions
		exist, the latest pre-release version is downloaded).

		Use '--version menu' or '--version menu-esr' to interactively select the
		OS version. The latter lists ESR versions which are only available for
		download on Production and Enterprise plans. See also:
		https://www.balena.io/docs/reference/OS/extended-support-release/

		Development images can be selected by appending \`.dev\` to the version.
`;
	public static examples = [
		'$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img',
		'$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version 2.101.7',
		'$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version 2022.7.0',
		'$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version ^2.90.0',
		'$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version 2.60.1+rev1',
		'$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version 2.60.1+rev1.dev',
		'$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version 2021.10.2.prod',
		'$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version latest',
		'$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version default',
		'$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version menu',
		'$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version menu-esr',
	];

	public static args = {
		type: Args.string({
			description: 'the device type',
			required: true,
		}),
	};

	public static usage = 'os download <type>';

	public static flags = {
		output: Flags.string({
			description: 'output path',
			char: 'o',
			required: true,
		}),
		version: Flags.string({
			description: stripIndent`
				version number (ESR or non-ESR versions),
				or semver range (non-ESR versions only),
				or 'latest' (includes pre-releases),
				or 'default' (excludes pre-releases if at least one released version is available),
				or 'recommended' (excludes pre-releases, will fail if only pre-release versions are available),
				or 'menu' (interactive menu, non-ESR versions),
				or 'menu-esr' (interactive menu, ESR versions)
				`,
		}),
		help: cf.help,
	};

	public async run() {
		const { args: params, flags: options } = await this.parse(OsDownloadCmd);

		// balenaOS ESR versions require user authentication
		if (options.version) {
			const { isESR } = await import('balena-image-manager');
			if (options.version === 'menu-esr' || isESR(options.version)) {
				try {
					await OsDownloadCmd.checkLoggedIn();
				} catch (e) {
					const { ExpectedError, NotLoggedInError } = await import(
						'../../errors.js'
					);
					if (e instanceof NotLoggedInError) {
						throw new ExpectedError(stripIndent`
							${e.message}
							User authentication is required to download balenaOS ESR versions.`);
					}
					throw e;
				}
			}
		}

		const { downloadOSImage } = await import('../../utils/cloud.js');

		try {
			await downloadOSImage(params.type, options.output, options.version);
		} catch (e) {
			e.deviceTypeSlug = params.type;
			e.message ||= '';
			if (
				e.code === 'BalenaRequestError' ||
				e.message.toLowerCase().includes('no such version')
			) {
				const version = options.version || '';
				if (
					!version.endsWith('.dev') &&
					!version.endsWith('.prod') &&
					/^v?\d+\.\d+\.\d+/.test(version)
				) {
					e.message += `
** Hint: some OS releases require specifying the full OS version including
** the '.prod' or '.dev' suffix, e.g. '--version 2021.10.2.prod'`;
				}
			}
			throw e;
		}
	}
}
