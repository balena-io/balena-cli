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

import { Flags, Args, Command } from '@oclif/core';
import type { Interfaces } from '@oclif/core';
import type * as BalenaSdk from 'balena-sdk';
import { ExpectedError } from '../../errors.js';
import * as cf from '../../utils/common-flags.js';
import { getBalenaSdk, stripIndent, getCliForm } from '../../utils/lazy.js';
import {
	applicationIdInfo,
	devModeInfo,
	secureBootInfo,
} from '../../utils/messages.js';
import type { ImgConfig } from '../../utils/config.js';

const CONNECTIONS_FOLDER = '/system-connections';

type ArgsDef = Interfaces.InferredArgs<typeof OsConfigureCmd.args>;
type FlagsDef = Interfaces.InferredFlags<typeof OsConfigureCmd.flags>;

interface Answers {
	appUpdatePollInterval: number; // in minutes
	network: 'ethernet' | 'wifi';
	wifiSsid?: string;
	wifiKey?: string;
}

interface AugmentedAnswers extends Answers {
	developmentMode?: boolean; // balenaOS development variant
	secureBoot?: boolean;
	deviceType: string; // e.g. "raspberrypi3"
	version: string; // e.g. "2.32.0+rev1"
	provisioningKeyName?: string;
	provisioningKeyExpiryDate?: string;
}

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

		The --device-type option is used to override the fleet's default device type,
		in case of a fleet with mixed device types.

		${devModeInfo.split('\n').join('\n\t\t')}

		${secureBootInfo.split('\n').join('\n\t\t')}

		The --system-connection (-c) option is used to inject NetworkManager connection
		profiles for additional network interfaces, such as cellular/GSM or additional
		WiFi or ethernet connections. This option may be passed multiple times in case there
		are multiple files to inject. See connection profile examples and reference at:
		https://www.balena.io/docs/reference/OS/network/2.x/
		https://developer.gnome.org/NetworkManager/stable/ref-settings.html

		${applicationIdInfo.split('\n').join('\n\t\t')}
	`;

	public static examples = [
		'$ balena os configure ../path/rpi3.img --device 7cf02a6',
		'$ balena os configure ../path/rpi3.img --fleet myorg/myfleet',
		'$ balena os configure ../path/rpi3.img -f myorg/myfleet --device-type raspberrypi3',
		'$ balena os configure ../path/rpi3.img --config myWifiConfig.json',
	];

	public static args = {
		image: Args.string({
			required: true,
			description: 'path to a balenaOS image file, e.g. "rpi3.img"',
		}),
	};

	public static flags = (() => {
		const inlineConfigFlags = {
			advanced: Flags.boolean({
				char: 'v',
				description:
					'ask advanced configuration questions (when in interactive mode)',
			}),
			'config-app-update-poll-interval': Flags.integer({
				description:
					'supervisor cloud polling interval in minutes (e.g. for variable updates)',
			}),
			'config-network': Flags.string({
				description: 'device network type (non-interactive configuration)',
				options: ['ethernet', 'wifi'],
			}),
			'config-wifi-key': Flags.string({
				description: 'WiFi key (password) (non-interactive configuration)',
			}),
			'config-wifi-ssid': Flags.string({
				description: 'WiFi SSID (network name) (non-interactive configuration)',
			}),
			dev: cf.dev,
			secureBoot: cf.secureBoot,
			'device-type': Flags.string({
				description:
					'device type slug (e.g. "raspberrypi3") to override the fleet device type',
				dependsOn: ['fleet'],
			}),
			'initial-device-name': Flags.string({
				description:
					'This option will set the device name when the device provisions',
			}),
			'provisioning-key-name': Flags.string({
				description:
					'custom key name assigned to generated provisioning api key',
				exclusive: ['config', 'device'],
			}),
			'provisioning-key-expiry-date': Flags.string({
				description:
					'expiry date assigned to generated provisioning api key (format: YYYY-MM-DD)',
				exclusive: ['config', 'device'],
			}),
		};
		return {
			fleet: { ...cf.fleet, exclusive: ['device', 'config'] },
			device: {
				...cf.device,
				exclusive: [
					'fleet',
					'device-type',
					'config',
					'provisioning-key-name',
					'provisioning-key-expiry-date',
				],
			},
			config: Flags.string({
				description:
					'path to a pre-generated config.json file to be injected in the OS image',
				// The only compatible flag with --config is 'system-connection'.
				exclusive: ['fleet', 'device', ...Object.keys(inlineConfigFlags)],
			}),
			...inlineConfigFlags,
			'system-connection': Flags.string({
				multiple: true,
				char: 'c',
				required: false,
				description:
					"paths to local files to place into the 'system-connections' directory",
			}),
		};
	})();

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(OsConfigureCmd);

		await validateArgsAndOptions(params, options);

		const devInit = await import('balena-device-init');
		const {
			generateDeviceConfig,
			generateApplicationConfig,
			readAndValidateConfigJson,
		} = await import('../../utils/config.js');
		const helpers = await import('../../utils/helpers.js');
		const { getApplication } = await import('../../utils/sdk.js');

		let app:
			| Pick<ApplicationWithDeviceTypeSlug, 'slug' | 'is_for__device_type'>
			| undefined;
		let device;
		let deviceTypeSlug = options['device-type'];
		let fleetSlugOrId: string | number | undefined = options.fleet;
		let secureBoot = options.secureBoot;
		let developmentMode = options.dev;

		const balena = getBalenaSdk();
		let configJson: ImgConfig | undefined;
		if (options.config != null) {
			configJson = await readAndValidateConfigJson(options.config);
			fleetSlugOrId = configJson.applicationId;
			deviceTypeSlug = configJson.deviceType;
			secureBoot = configJson.installer?.secureboot === true;
			developmentMode = configJson.developmentMode === true;
		}

		if (options.device) {
			device = (await balena.models.device.get(options.device, {
				$expand: {
					is_of__device_type: { $select: 'slug' },
				},
			})) as DeviceWithDeviceType & {
				belongs_to__application: BalenaSdk.PineDeferred;
			};
			deviceTypeSlug = device.is_of__device_type[0].slug;
		} else if (fleetSlugOrId != null) {
			app = await getApplication(balena, fleetSlugOrId, {
				$select: 'slug',
				$expand: {
					is_for__device_type: { $select: 'slug' },
				},
			});
			await checkDeviceTypeCompatibility(deviceTypeSlug, app);
			deviceTypeSlug ??= app.is_for__device_type[0].slug;
		} else {
			throw new Error(
				'Unreachable: neither a device nor a fleet were specified or resolved by the config json',
			);
		}

		const deviceTypeManifest = await helpers.getManifest(
			params.image,
			deviceTypeSlug,
		);

		const { normalizeOsVersion } = await import('../../utils/normalization.js');
		const osVersion = normalizeOsVersion(
			await getOsVersionFromImage(params.image, deviceTypeManifest, devInit),
		);

		const { validateDevOptionAndWarn } = await import('../../utils/config.js');
		await validateDevOptionAndWarn(developmentMode, osVersion);

		const { validateSecureBootOptionAndWarn } = await import(
			'../../utils/config.js'
		);
		await validateSecureBootOptionAndWarn(
			secureBoot,
			deviceTypeSlug,
			osVersion,
		);

		const _ = await import('lodash');
		const baseAnswers: Answers =
			configJson == null
				? await askQuestionsForDeviceType(deviceTypeManifest, options)
				: {
						appUpdatePollInterval: configJson.appUpdatePollInterval,
						network:
							!configJson.wifiSsid && !configJson.wifiKey ? 'ethernet' : 'wifi',
						..._.pick(configJson, ['wifiSsid', 'wifiKey']),
					};
		const answers: AugmentedAnswers = {
			...baseAnswers,
			deviceType: deviceTypeSlug,
			version: osVersion,
			developmentMode: developmentMode,
			secureBoot: secureBoot,
		};

		if (configJson == null) {
			answers.provisioningKeyName = options['provisioning-key-name'];
			answers.provisioningKeyExpiryDate =
				options['provisioning-key-expiry-date'];
			if (device != null) {
				configJson = await generateDeviceConfig(device, undefined, answers);
			} else {
				configJson = await generateApplicationConfig(app!, answers);
			}
			if (
				options['initial-device-name'] != null &&
				options['initial-device-name'] !== ''
			) {
				configJson.initialDeviceName = options['initial-device-name'];
			}
		}

		console.info('Configuring operating system image');

		const image = params.image;
		await helpers.osProgressHandler(
			await devInit.configure(image, deviceTypeManifest, configJson, answers),
		);

		if (options['system-connection']) {
			const path = await import('path');
			const fs = await import('fs/promises');

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
					await _fs.promises.writeFile(
						path.join(CONNECTIONS_FOLDER, name),
						content,
					);
				});
				console.info(`Copied system-connection file: ${name}`);
			}
		}
	}
}

async function validateArgsAndOptions(args: ArgsDef, options: FlagsDef) {
	// The 'device', 'application' & 'config` options are declared "exclusive" in the oclif
	// flag definitions above, so oclif will enforce that they are not used together.
	if (!options.device && !options.fleet && !options.config) {
		throw new ExpectedError(
			"One of the '--device', '--fleet' or '--config' options must be provided",
		);
	}

	const { validateFilePath } = await import('../../utils/validation.js');
	await validateFilePath(args.image);

	if (options.config != null) {
		await validateFilePath(options.config);
	}

	const { checkLoggedIn } = await import('../../utils/patterns.js');

	await checkLoggedIn();
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
		throw new ExpectedError('Could not read OS version from the image.');
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
	deviceType: string | undefined,
	app: {
		slug: string;
		is_for__device_type: Array<Pick<BalenaSdk.DeviceType['Read'], 'slug'>>;
	},
) {
	if (deviceType) {
		const helpers = await import('../../utils/helpers.js');
		if (
			!(await helpers.areDeviceTypesCompatible(
				app.is_for__device_type[0].slug,
				deviceType,
			))
		) {
			throw new ExpectedError(
				`Device type ${deviceType} is incompatible with fleet ${app.is_for__device_type[0].slug}`,
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
): Promise<Answers> {
	const answerSources: any[] = [
		{
			...camelifyConfigOptions(options),
			app: options.fleet,
			application: options.fleet,
		},
	];
	const defaultAnswers: Partial<Answers> = {};
	const questions = deviceType.options ?? [];
	let extraOpts: { override: Partial<Answers> } | undefined;

	if (!options.advanced) {
		const advancedGroup = questions.find(
			(question) => question.name === 'advanced' && question.isGroup,
		);
		if (advancedGroup != null && Object.keys(advancedGroup).length > 0) {
			const helpers = await import('../../utils/helpers.js');
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

	if (defaultAnswers != null && Object.keys(defaultAnswers).length > 0) {
		extraOpts = { override: defaultAnswers };
	}

	return (await getCliForm().run(questions, extraOpts)) as Answers;
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
function getQuestionNames(deviceType: BalenaSdk.DeviceTypeJson.DeviceType) {
	const questionNames =
		deviceType.options
			?.flatMap(
				(group: BalenaSdk.DeviceTypeJson.DeviceTypeOptions) =>
					(group.isGroup && group.options) || [],
			)
			.map(
				(groupOption: BalenaSdk.DeviceTypeJson.DeviceTypeOptionsGroup) =>
					groupOption.name as keyof Answers,
			)
			.filter(Boolean) ?? [];
	return questionNames;
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
	return Object.fromEntries(
		Object.entries(options).map(([key, value]) => {
			if (key.startsWith('config-')) {
				return [
					key
						.substring('config-'.length)
						.replace(/-[a-z]/g, (match) => match.substring(1).toUpperCase()),
					value,
				];
			}
			return [key, value];
		}),
	);
}
