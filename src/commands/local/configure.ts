/**
 * @license
 * Copyright 2016-2021 Balena Ltd.
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

import { Args } from '@oclif/core';
import { promisify } from 'util';
import Command from '../../command.js';
import * as cf from '../../utils/common-flags.js';
import { stripIndent } from '../../utils/lazy.js';

export default class LocalConfigureCmd extends Command {
	public static description = stripIndent`
		(Re)configure a balenaOS drive or image.

		Configure or reconfigure a balenaOS drive or image.
	`;

	public static examples = [
		'$ balena local configure /dev/sdc',
		'$ balena local configure path/to/image.img',
	];

	public static args = {
		target: Args.string({
			description: 'path of drive or image to configure',
			required: true,
		}),
	};

	public static usage = 'local configure <target>';

	public static flags = {
		help: cf.help,
	};

	public static root = true;
	public static offlineCompatible = true;

	public async run() {
		const { args: params } = await this.parse(LocalConfigureCmd);

		const reconfix = await import('reconfix');
		const { denyMount, safeUmount } = await import('../../utils/umount.js');
		const { default: Logger } = await import('../../utils/logger.js');

		const logger = Logger.getLogger();

		const configurationSchema = await this.prepareConnectionFile(params.target);

		await denyMount(params.target, async () => {
			// TODO: safeUmount umounts drives like '/dev/sdc', but does not
			// umount image files like 'balena.img'
			await safeUmount(params.target);
			const config = await reconfix.readConfiguration(
				configurationSchema,
				params.target,
			);
			logger.logDebug('Current config:');
			logger.logDebug(JSON.stringify(config));
			const answers = await this.getConfiguration(config);
			logger.logDebug('New config:');
			logger.logDebug(JSON.stringify(answers));
			if (!answers.hostname) {
				await this.removeHostname(configurationSchema);
			}
			await reconfix.writeConfiguration(
				configurationSchema,
				answers,
				params.target,
			);
		});

		console.log('Done!');
	}

	readonly CONNECTIONS_FOLDER = '/system-connections';

	getConfigurationSchema(bootPartition?: number, connectionFileName?: string) {
		connectionFileName ??= 'resin-wifi';
		return {
			mapper: [
				{
					template: {
						persistentLogging: '{{persistentLogging}}',
					},
					domain: [['config_json', 'persistentLogging']],
				},
				{
					template: {
						hostname: '{{hostname}}',
					},
					domain: [['config_json', 'hostname']],
				},
				{
					template: {
						developmentMode: '{{developmentMode}}',
					},
					domain: [['config_json', 'developmentMode']],
				},
				{
					template: {
						wifi: {
							ssid: '{{networkSsid}}',
						},
						'wifi-security': {
							psk: '{{networkKey}}',
						},
					},
					domain: [
						['system_connections', connectionFileName, 'wifi'],
						['system_connections', connectionFileName, 'wifi-security'],
					],
				},
			],
			files: {
				system_connections: {
					fileset: true,
					type: 'ini',
					location: {
						path: this.CONNECTIONS_FOLDER.slice(1),
						// Reconfix still uses the older resin-image-fs, so still needs an
						// object-based partition definition.
						partition: bootPartition,
					},
				},
				config_json: {
					type: 'json',
					location: {
						path: 'config.json',
						partition: bootPartition,
					},
				},
			},
		};
	}

	inquirerOptions = (data: any) => [
		{
			message: 'Network SSID',
			type: 'input',
			name: 'networkSsid',
			default: data.networkSsid,
		},
		{
			message: 'Network Key',
			type: 'input',
			name: 'networkKey',
			default: data.networkKey,
		},
		{
			message:
				'Enable development mode? (Open ports and root access - Not for production!)',
			type: 'confirm',
			name: 'developmentMode',
			default: false,
		},
		{
			message: 'Do you want to set advanced settings?',
			type: 'confirm',
			name: 'advancedSettings',
			default: false,
		},
		{
			message: 'Device Hostname',
			type: 'input',
			name: 'hostname',
			default: data.hostname,
			when(answers: any) {
				return answers.advancedSettings;
			},
		},
		{
			message: 'Do you want to enable persistent logging?',
			type: 'confirm',
			name: 'persistentLogging',
			default: data.persistentLogging,
			when(answers: any) {
				return answers.advancedSettings;
			},
		},
	];

	getConfiguration = async (data: any) => {
		const _ = await import('lodash');
		const inquirer = await import('inquirer');

		// `persistentLogging` can be `undefined`, so we want
		// to make sure that case defaults to `false`
		data = _.assign(data, {
			persistentLogging: data.persistentLogging || false,
		});

		const answers = await inquirer.prompt(this.inquirerOptions(data));
		return _.merge(data, answers);
	};

	// Taken from https://goo.gl/kr1kCt
	readonly CONNECTION_FILE = stripIndent`
		[connection]
		id=resin-wifi
		type=wifi

		[wifi]
		hidden=true
		mode=infrastructure
		ssid=My_Wifi_Ssid

		[wifi-security]
		auth-alg=open
		key-mgmt=wpa-psk
		psk=super_secret_wifi_password

		[ipv4]
		method=auto

		[ipv6]
		addr-gen-mode=stable-privacy
		method=auto\
	`;

	/*
	 * if the `resin-wifi` file exists (previously configured image or downloaded from the UI) it's used and reconfigured
	 * if the `resin-sample.ignore` exists it's copied to `resin-wifi`
	 * if the `resin-sample` exists it's reconfigured (legacy mode, will be removed eventually)
	 * otherwise, the new file is created
	 */
	async prepareConnectionFile(target: string) {
		const _ = await import('lodash');
		const imagefs = await import('balena-image-fs');
		const { getBootPartition } = await import('balena-config-json');

		const bootPartition = await getBootPartition(target);

		const files = await imagefs.interact(target, bootPartition, async (_fs) => {
			return await promisify(_fs.readdir)(this.CONNECTIONS_FOLDER);
		});

		let connectionFileName;
		if (_.includes(files, 'resin-wifi')) {
			// The required file already exists, nothing to do
		} else if (_.includes(files, 'resin-sample.ignore')) {
			// Fresh image, new mode, accoding to https://github.com/balena-os/meta-balena/pull/770/files
			await imagefs.interact(target, bootPartition, async (_fs) => {
				const readFileAsync = promisify(_fs.readFile);
				const writeFileAsync = promisify(_fs.writeFile);
				const contents = await readFileAsync(
					`${this.CONNECTIONS_FOLDER}/resin-sample.ignore`,
					{ encoding: 'utf8' },
				);
				return await writeFileAsync(
					`${this.CONNECTIONS_FOLDER}/resin-wifi`,
					contents,
				);
			});
		} else if (_.includes(files, 'resin-sample')) {
			// Legacy mode, to be removed later
			// We return the file name override from this branch
			// When it is removed the following cleanup should be done:
			// * delete all the null returns from this method
			// * turn `getConfigurationSchema` back into the constant, with the connection filename always being `resin-wifi`
			// * drop the final `then` from this method
			// * adapt the code in the main listener to not receive the config from this method, and use that constant instead
			connectionFileName = 'resin-sample';
		} else {
			// In case there's no file at all (shouldn't happen normally, but the file might have been removed)
			await imagefs.interact(target, bootPartition, async (_fs) => {
				return await promisify(_fs.writeFile)(
					`${this.CONNECTIONS_FOLDER}/resin-wifi`,
					this.CONNECTION_FILE,
				);
			});
		}
		return await this.getConfigurationSchema(bootPartition, connectionFileName);
	}

	async removeHostname(schema: any) {
		const _ = await import('lodash');
		schema.mapper = _.reject(schema.mapper, (mapper: any) =>
			_.isEqual(Object.keys(mapper.template), ['hostname']),
		);
	}
}
