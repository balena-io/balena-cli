/**
 * @license
 * Copyright 2019 Balena Ltd.
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

import { flags } from '@oclif/command';
import type * as BalenaSdk from 'balena-sdk';
import { promisify } from 'util';
import * as _ from 'lodash';
import Command from '../../command';
import { ExpectedError } from '../../errors';
import * as cf from '../../utils/common-flags';
import { getBalenaSdk, stripIndent, getCliForm } from '../../utils/lazy';
import {
	applicationIdInfo,
	appToFleetFlagMsg,
	warnify,
} from '../../utils/messages';
import { isV13 } from '../../utils/version';

const CONNECTIONS_FOLDER = '/system-connections';

interface FlagsDef {
	advanced?: boolean;
	application?: string;
	app?: string;
	fleet?: string;
	config?: string;
	'config-app-update-poll-interval'?: number;
	'config-network'?: string;
	'config-wifi-key'?: string;
	'config-wifi-ssid'?: string;
	device?: string; // device UUID
	'device-api-key'?: string;
	'device-type'?: string;
	help?: void;
	version?: string;
	'system-connection': string[];
	'initial-device-name'?: string;
	'provisioning-key-name'?: string;
}

interface ArgsDef {
	image: string;
}

interface Answers {
	appUpdatePollInterval: number; // in minutes
	deviceType: string; // e.g. "raspberrypi3"
	network: 'ethernet' | 'wifi';
	version: string; // e.g. "2.32.0+rev1"
	wifiSsid?: string;
	wifiKey?: string;
	provisioningKeyName?: string;
}

const deviceApiKeyDeprecationMsg = stripIndent`
	The --device-api-key option is deprecated and will be removed in a future release.
	A suitable key is automatically generated or fetched if this option is omitted.`;

export default class OsConfigureCmd extends Command {
	public static description = stripIndent`
		Configure a previously downloaded balenaOS image.

		Configure a previously downloaded balenaOS image for a specific device type
		or fleet.

		Configuration settings such as WiFi authentication will be taken from the
		following sources, in precedence order:
		1. Command-line options like \`--config-wifi-ssid\`
		2. A given \`config.json\` file specified with the \`--config\` option.
		3. User input through interactive prompts (text menus).

		The --device-type option may be used to override the fleet's default device
		type, in case of a fleet with mixed device types.

		The --system-connection (-c) option can be used to inject NetworkManager connection
		profiles for additional network interfaces, such as cellular/GSM or additional
		WiFi or ethernet connections. This option may be passed multiple times in case there
		are multiple files to inject. See connection profile examples and reference at:
		https://www.balena.io/docs/reference/OS/network/2.x/
		https://developer.gnome.org/NetworkManager/stable/ref-settings.html

		${deviceApiKeyDeprecationMsg.split('\n').join('\n\t\t')}

		${applicationIdInfo.split('\n').join('\n\t\t')}

		Note: This command is currently not supported on Windows natively. Windows users
		are advised to install the Windows Subsystem for Linux (WSL) with Ubuntu, and use
		the Linux release of the balena CLI:
		https://docs.microsoft.com/en-us/windows/wsl/about
	`;

	public static examples = [
		'$ balena os configure ../path/rpi3.img --device 7cf02a6',
		'$ balena os configure ../path/rpi3.img --device 7cf02a6 --device-api-key <existingDeviceKey>',
		'$ balena os configure ../path/rpi3.img --fleet myorg/myfleet',
		'$ balena os configure ../path/rpi3.img --fleet MyFleet --version 2.12.7',
		'$ balena os configure ../path/rpi3.img -f MyFinFleet --device-type raspberrypi3',
		'$ balena os configure ../path/rpi3.img -f MyFinFleet --device-type raspberrypi3 --config myWifiConfig.json',
	];

	public static args = [
		{
			name: 'image',
			required: true,
			description: 'path to a balenaOS image file, e.g. "rpi3.img"',
		},
	];

	public static usage = 'os configure <image>';

	public static flags: flags.Input<FlagsDef> = {
		advanced: flags.boolean({
			char: 'v',
			description:
				'ask advanced configuration questions (when in interactive mode)',
		}),
		...(isV13()
			? {}
			: {
					application: {
						...cf.application,
						exclusive: ['app', 'fleet', 'device'],
					},
					app: {
						...cf.app,
						exclusive: ['application', 'fleet', 'device'],
					},
			  }),
		fleet: {
			...cf.fleet,
			exclusive: ['app', 'application', 'device'],
		},
		config: flags.string({
			description:
				'path to a pre-generated config.json file to be injected in the OS image',
			exclusive: ['provisioning-key-name'],
		}),
		'config-app-update-poll-interval': flags.integer({
			description:
				'supervisor cloud polling interval in minutes (e.g. for variable updates)',
		}),
		'config-network': flags.string({
			description: 'device network type (non-interactive configuration)',
			options: ['ethernet', 'wifi'],
		}),
		'config-wifi-key': flags.string({
			description: 'WiFi key (password) (non-interactive configuration)',
		}),
		'config-wifi-ssid': flags.string({
			description: 'WiFi SSID (network name) (non-interactive configuration)',
		}),
		device: {
			exclusive: ['app', 'application', 'fleet', 'provisioning-key-name'],
			...cf.device,
		},
		'device-api-key': flags.string({
			char: 'k',
			description:
				'custom device API key (DEPRECATED and only supported with balenaOS 2.0.3+)',
		}),
		'device-type': flags.string({
			description:
				'device type slug (e.g. "raspberrypi3") to override the fleet device type',
		}),
		'initial-device-name': flags.string({
			description:
				'This option will set the device name when the device provisions',
		}),
		version: flags.string({
			description: 'balenaOS version, for example "2.32.0" or "2.44.0+rev1"',
		}),
		'system-connection': flags.string({
			multiple: true,
			char: 'c',
			required: false,
			description:
				"paths to local files to place into the 'system-connections' directory",
		}),
		'provisioning-key-name': flags.string({
			description: 'custom key name assigned to generated provisioning api key',
			exclusive: ['config', 'device'],
		}),
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			OsConfigureCmd,
		);
		if ((options.application || options.app) && process.stderr.isTTY) {
			console.error(warnify(appToFleetFlagMsg));
		}
		options.application ||= options.app || options.fleet;

		await validateOptions(options);

		const devInit = await import('balena-device-init');
		const { promises: fs } = await import('fs');
		const { generateDeviceConfig, generateApplicationConfig } = await import(
			'../../utils/config'
		);
		const helpers = await import('../../utils/helpers');
		const { getApplication } = await import('../../utils/sdk');

		let app: ApplicationWithDeviceType | undefined;
		let device;
		let deviceTypeSlug: string;

		const balena = getBalenaSdk();
		if (options.device) {
			device = (await balena.models.device.get(options.device, {
				$expand: {
					is_of__device_type: { $select: 'slug' },
				},
			})) as DeviceWithDeviceType & {
				belongs_to__application: BalenaSdk.PineDeferred;
			};
			deviceTypeSlug = device.is_of__device_type[0].slug;
		} else {
			app = (await getApplication(balena, options.application!, {
				$expand: {
					is_for__device_type: { $select: 'slug' },
				},
			})) as ApplicationWithDeviceType;
			await checkDeviceTypeCompatibility(balena, options, app);
			deviceTypeSlug =
				options['device-type'] || app.is_for__device_type[0].slug;
		}

		const deviceTypeManifest = await helpers.getManifest(
			params.image,
			deviceTypeSlug,
		);

		let configJson: import('../../utils/config').ImgConfig | undefined;
		if (options.config) {
			const rawConfig = await fs.readFile(options.config, 'utf8');
			configJson = JSON.parse(rawConfig);
		}

		const answers: Answers = await askQuestionsForDeviceType(
			deviceTypeManifest,
			options,
			configJson,
		);
		if (options.application) {
			answers.deviceType = deviceTypeSlug;
		}
		answers.version =
			options.version ||
			(await getOsVersionFromImage(params.image, deviceTypeManifest, devInit));

		answers.provisioningKeyName = options['provisioning-key-name'];

		if (_.isEmpty(configJson)) {
			if (device) {
				configJson = await generateDeviceConfig(
					device,
					options['device-api-key'],
					answers,
				);
			} else {
				configJson = await generateApplicationConfig(app!, answers);
			}
		}

		if (
			options['initial-device-name'] &&
			options['initial-device-name'] !== ''
		) {
			configJson!.initialDeviceName = options['initial-device-name'];
		}

		console.info('Configuring operating system image');

		const image = params.image;
		await helpers.osProgressHandler(
			await devInit.configure(
				image,
				deviceTypeManifest,
				configJson || {},
				answers,
			),
		);

		if (options['system-connection']) {
			const path = await import('path');

			const files = await Promise.all(
				options['system-connection'].map(async (filePath) => {
					const content = await fs.readFile(filePath, 'utf8');
					const name = path.basename(filePath);

					return {
						name,
						content,
					};
				}),
			);

			const { getBootPartition } = await import('balena-config-json');
			const bootPartition = await getBootPartition(params.image);

			const imagefs = await import('balena-image-fs');

			for (const { name, content } of files) {
				await imagefs.interact(image, bootPartition, async (_fs) => {
					return await promisify(_fs.writeFile)(
						path.join(CONNECTIONS_FOLDER, name),
						content,
					);
				});
				console.info(`Copied system-connection file: ${name}`);
			}
		}
	}
}

async function validateOptions(options: FlagsDef) {
	// The 'device' and 'application' options are declared "exclusive" in the oclif
	// flag definitions above, so oclif will enforce that they are not both used together.
	if (!options.device && !options.application) {
		throw new ExpectedError(
			"Either the '--device' or the '--fleet' option must be provided",
		);
	}
	if (!options.application && options['device-type']) {
		throw new ExpectedError(
			"The '--device-type' option can only be used in conjunction with the '--fleet' option",
		);
	}
	if (options['device-api-key']) {
		console.error(stripIndent`
			-------------------------------------------------------------------------------------------
			Warning: ${deviceApiKeyDeprecationMsg.split('\n').join('\n\t\t\t')}
			-------------------------------------------------------------------------------------------
		`);
	}

	await Command.checkLoggedIn();
}

/**
 * Wrapper around balena-device-init.getImageOsVersion(). Throws ExpectedError
 * if the OS image could not be read or the OS version could not be extracted
 * from it.
 * @param imagePath Local filesystem path to a balenaOS image file
 * @param deviceTypeManifest Device type manifest object
 */
async function getOsVersionFromImage(
	imagePath: string,
	deviceTypeManifest: BalenaSdk.DeviceTypeJson.DeviceType,
	devInit: typeof import('balena-device-init'),
): Promise<string> {
	const osVersion = await devInit.getImageOsVersion(
		imagePath,
		deviceTypeManifest,
	);
	if (!osVersion) {
		throw new ExpectedError(stripIndent`
			Could not read OS version from the image. Please specify the balenaOS
			version manually with the --version command-line option.`);
	}
	return osVersion;
}

/**
 * Check that options['device-type'], e.g. 'raspberrypi3', is compatible with
 * app.device_type, e.g. 'raspberry-pi2'. Throws ExpectedError if they are not
 * compatible.
 * @param sdk Balena Node SDK instance
 * @param options oclif command-line options object
 * @param app Balena SDK Application model object
 */
async function checkDeviceTypeCompatibility(
	sdk: BalenaSdk.BalenaSDK,
	options: FlagsDef,
	app: ApplicationWithDeviceType,
) {
	if (options['device-type']) {
		const [appDeviceType, optionDeviceType] = await Promise.all([
			sdk.models.device.getManifestBySlug(app.is_for__device_type[0].slug),
			sdk.models.device.getManifestBySlug(options['device-type']),
		]);
		const helpers = await import('../../utils/helpers');
		if (!helpers.areDeviceTypesCompatible(appDeviceType, optionDeviceType)) {
			throw new ExpectedError(
				`Device type ${options['device-type']} is incompatible with fleet ${options.application}`,
			);
		}
	}
}

/**
 * Check if the given options or configJson objects (in this order) contain
 * the answers to some configuration questions, and interactively ask the
 * user the questions for which answers are missing. Questions such as:
 *
 *     ? Network Connection (Use arrow keys)
 *       ethernet
 *     ❯ wifi
 *     ? Network Connection wifi
 *     ? Wifi SSID i-ssid
 *     ? Wifi Passphrase [input is hidden]
 *
 * The questions are extracted from the given deviceType "manifest".
 */
async function askQuestionsForDeviceType(
	deviceType: BalenaSdk.DeviceTypeJson.DeviceType,
	options: FlagsDef,
	configJson?: import('../../utils/config').ImgConfig,
): Promise<Answers> {
	const answerSources: any[] = [camelifyConfigOptions(options)];
	const defaultAnswers: Partial<Answers> = {};
	const questions: any = deviceType.options;
	let extraOpts: { override: object } | undefined;

	if (!_.isEmpty(configJson)) {
		answerSources.push(configJson);
	}

	if (!options.advanced) {
		const advancedGroup: any = _.find(questions, {
			name: 'advanced',
			isGroup: true,
		});
		if (!_.isEmpty(advancedGroup)) {
			const helpers = await import('../../utils/helpers');
			answerSources.push(helpers.getGroupDefaults(advancedGroup));
		}
	}

	for (const questionName of getQuestionNames(deviceType)) {
		for (const answerSource of answerSources) {
			if (answerSource[questionName] != null) {
				defaultAnswers[questionName] = answerSource[questionName];
				break;
			}
		}
	}
	if (
		!defaultAnswers.network &&
		(defaultAnswers.wifiSsid || defaultAnswers.wifiKey)
	) {
		defaultAnswers.network = 'wifi';
	}

	if (!_.isEmpty(defaultAnswers)) {
		extraOpts = { override: defaultAnswers };
	}

	return getCliForm().run(questions, extraOpts);
}

/**
 * Given a deviceType "manifest" containing "options" properties, return an
 * array of "question names" as in the following example.
 *
 * @param deviceType Device type "manifest", for example:
 *    {   "slug": "raspberrypi3",
 *        "options": [{
 *                "options": [ {
 *                        "name": "network",
 *                        "choices": ["ethernet", "wifi"],
 *                        ... }, {
 *                        "name": "wifiSsid",
 *                        "type": "text",
 *                        ... }, {
 *                "options": [ {
 *                        "name": "appUpdatePollInterval",
 *                        "default": 10,
 *                        ...
 * @return Array of question names, for example:
 *     [ 'network', 'wifiSsid', 'wifiKey', 'appUpdatePollInterval' ]
 */
function getQuestionNames(
	deviceType: BalenaSdk.DeviceTypeJson.DeviceType,
): Array<keyof Answers> {
	const questionNames: string[] = _.chain(deviceType.options)
		.flatMap(
			(group: BalenaSdk.DeviceTypeJson.DeviceTypeOptions) =>
				(group.isGroup && group.options) || [],
		)
		.map(
			(groupOption: BalenaSdk.DeviceTypeJson.DeviceTypeOptionsGroup) =>
				groupOption.name,
		)
		.filter()
		.value();
	return questionNames as Array<keyof Answers>;
}

/**
 * Create and return a new object with the key-value pairs from the input object,
 * renaming keys that start with the 'config-' prefix as follows:
 * Sample input:
 *     { app: 'foo', 'config-wifi-key': 'mykey', 'config-wifi-ssid': 'myssid' }
 * Output:
 *     { app: 'foo', wifiKey: 'mykey', wifiSsid: 'myssid' }
 */
function camelifyConfigOptions(options: FlagsDef): { [key: string]: any } {
	return _.mapKeys(options, (_value, key) => {
		if (key.startsWith('config-')) {
			return key
				.substring('config-'.length)
				.replace(/-[a-z]/g, (match) => match.substring(1).toUpperCase());
		}
		return key;
	});
}
