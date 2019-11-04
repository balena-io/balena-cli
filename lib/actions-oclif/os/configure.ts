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

import { Command, flags } from '@oclif/command';
import BalenaSdk = require('balena-sdk');
import { stripIndent } from 'common-tags';
import * as _ from 'lodash';

import { ExpectedError } from '../../errors';
import * as cf from '../../utils/common-flags';
import { CommandHelp } from '../../utils/oclif-utils';

interface FlagsDef {
	advanced?: boolean;
	appUpdatePollInterval?: number;
	app?: string;
	application?: string;
	config?: string;
	device?: string; // device UUID
	'device-api-key'?: string;
	'device-type'?: string;
	help?: void;
	version?: string;
	wifiSsid?: string;
	wifiKey?: string;
}

interface ArgsDef {
	image: string;
}

interface DeferredDevice extends BalenaSdk.Device {
	belongs_to__application: BalenaSdk.PineDeferred;
}

interface Answers {
	appUpdatePollInterval: number; // in minutes
	deviceType: string; // e.g. "raspberrypi3"
	network: 'ethernet' | 'wifi';
	version: string; // e.g. "2.32.0+rev1"
	wifiSsid?: string;
	wifiKey?: string;
}

export default class OsConfigureCmd extends Command {
	public static description = stripIndent`
		Configure a previously downloaded balenaOS image.

		Configure a previously downloaded balenaOS image for a specific device type or
		balena application.

		This command will try to automatically determine the operating system version in order
		to correctly configure the image. It may fail to do so however, in which case you'll
		have to call this command again with the exact version number of the targeted image.

		Note that device api keys are only supported on balenaOS 2.0.3+.

		This command still supports the *deprecated* format where the UUID and optionally device key
		are passed directly on the command line, but the recommended way is to pass either an --app or
		--device argument. The deprecated format will be removed in a future release.

		In case that you want to configure an image for an application with mixed device types,
		you can pass the --device-type argument along with --app to specify the target device type.
	`;
	public static examples = [
		'$ balena os configure ../path/rpi3.img --device 7cf02a6',
		'$ balena os configure ../path/rpi3.img --device 7cf02a6 --device-api-key <existingDeviceKey>',
		'$ balena os configure ../path/rpi3.img --app MyApp',
		'$ balena os configure ../path/rpi3.img --app MyApp --version 2.12.7',
		'$ balena os configure ../path/rpi3.img --app MyFinApp --device-type raspberrypi3',
	];

	public static args = [
		{
			name: 'image',
			required: true,
			description: 'path to a balenaOS image file, e.g. "rpi3.img"',
		},
	];

	// hardcoded 'env add' to avoid oclif's 'env:add' topic syntax
	public static usage =
		'os configure ' +
		new CommandHelp({ args: OsConfigureCmd.args }).defaultUsage();

	public static flags: flags.Input<FlagsDef> = {
		advanced: flags.boolean({
			char: 'v',
			description:
				'ask advanced configuration questions (when in interactive mode)',
		}),
		app: flags.string({
			description: "same as '--application'",
			exclusive: ['application', 'device'],
		}),
		application: _.assign({ exclusive: ['app', 'device'] }, cf.application),
		appUpdatePollInterval: flags.integer({
			description:
				'Interval (in minutes) for the on-device balena supervisor periodic app update check',
		}),
		config: flags.string({
			description:
				'path to a pre-generated config.json file, see `balena os build-config`',
		}),
		device: _.assign({ exclusive: ['app', 'application'] }, cf.device),
		'device-api-key': flags.string({
			char: 'k',
			description:
				'custom device API key (only supported with balenaOS 2.0.3+)',
		}),
		'device-type': flags.string({
			description:
				'device type slug (e.g. "raspberrypi3") to override the app device type',
		}),
		help: cf.help,
		version: flags.string({
			description: 'balenaOS version, for example "2.32.0" or "2.44.0+rev1"',
		}),
		wifiKey: flags.string({
			description:
				'WiFi key (password) (optional non-interactive WiFi configuration)',
		}),
		wifiSsid: flags.string({
			description:
				'WiFi SSID (network name) (optional non-interactive WiFi configuration)',
		}),
	};

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			OsConfigureCmd,
		);

		const init = await import('balena-device-init');
		const balena = (await import('balena-sdk')).fromSharedOptions();
		const fs = await import('mz/fs');

		const { generateDeviceConfig, generateApplicationConfig } = await import(
			'../../utils/config'
		);
		const helpers = await import('../../utils/helpers');
		const { checkLoggedIn } = await import('../../utils/patterns');

		// Prefer options.application over options.app
		options.application = options.application || options.app;
		options.app = undefined;

		// The 'device' and 'application' options are declared "exclusive" in the oclif
		// flag definitions above, so oclif will enforce that they are not both used together.
		if (!options.device && !options.application) {
			throw new ExpectedError(
				"Either the '--device' or the '--application' option must be provided",
			);
		}

		if (!options.application && options['device-type']) {
			throw new ExpectedError(
				"The '--device-type' option can only be used in conjunction with the '--application' option",
			);
		}

		await checkLoggedIn();

		console.info('Configuring operating system image');

		const configurationResourceType = options.device ? 'device' : 'application';
		let app: BalenaSdk.Application | undefined;
		let device: BalenaSdk.Device | undefined;
		let deviceTypeSlug: string;

		if (options.device) {
			device = await balena.models['device'].get(options.device);
			deviceTypeSlug = device.device_type;
		} else {
			app = await balena.models['application'].get(options.application!);
			deviceTypeSlug = options['device-type'] || app.device_type;
		}
		// const appOrDevice = await balena.models[configurationResourceType].get(uuid || options.application || '');

		const deviceTypeManifest = await helpers.getManifest(
			params.image,
			deviceTypeSlug,
		);

		console.log(
			`deviceTypeManifest: ${JSON.stringify(deviceTypeManifest, null, 4)}\n`,
		);

		await checkDeviceTypeCompatibility(balena, options, app);

		// let answers: Answers;
		let configJson: import('../../utils/config').ImgConfig | undefined;

		const osVersion =
			options.version ||
			(await getOsVersionFromImage(params.image, deviceTypeManifest));

		if (options.config) {
			const rawConfig = await fs.readFile(options.config, 'utf8');
			// answers = JSON.parse(rawConfig);
			configJson = JSON.parse(rawConfig);
		}

		const answers: Answers = await askQuestionsForDeviceType(
			deviceTypeManifest,
			// options.advanced,
			options,
			configJson,
		);
		console.log(`answers (1): ${JSON.stringify(answers)}\n`);

		if (configurationResourceType === 'application') {
			answers.deviceType = deviceTypeSlug;
		}

		answers.version = osVersion;

		console.log(`answers (2): ${JSON.stringify(answers)}\n`);

		if (_.isEmpty(configJson)) {
			// Generate a config.json object from a device or application
			if (device) {
				console.log(
					'inspect(device):\n',
					(await import('util')).inspect(device),
				);

				configJson = await generateDeviceConfig(
					device as DeferredDevice,
					options['device-api-key'],
					answers,
				);
			} else {
				console.log('inspect(app):\n', (await import('util')).inspect(app!));
				configJson = await generateApplicationConfig(app!, answers);
			}
			console.log(`generated config.json: ${JSON.stringify(configJson)}\n`);
		} else {
			console.log(`using given config.json: ${JSON.stringify(configJson)}\n`);
		}

		console.log('calling init.configure() ...');
		await helpers.osProgressHandler(
			await init.configure(
				params.image,
				deviceTypeManifest,
				configJson || {},
				answers,
			),
		);
	}
}

async function getOsVersionFromImage(
	imagePath: string,
	deviceTypeManifest: BalenaSdk.DeviceType,
): Promise<string> {
	const helpers = await import('../../utils/helpers');
	const osVersion = await helpers.getOsVersion(imagePath, deviceTypeManifest);
	if (!osVersion) {
		throw new ExpectedError(
			'Could not read OS version from the image. ' +
				'Please specify the version manually with the ' +
				'--version argument to this command.',
		);
	}
	console.log(`successfully read OS version: ${osVersion}`);
	return osVersion;
}

async function checkDeviceTypeCompatibility(
	sdk: BalenaSdk.BalenaSDK,
	options: FlagsDef,
	app?: BalenaSdk.Application,
) {
	if (app && options['device-type']) {
		const [appDeviceType, optionDeviceType] = await Promise.all([
			sdk.models.device.getManifestBySlug(app.device_type),
			sdk.models.device.getManifestBySlug(options['device-type']),
		]);
		const helpers = await import('../../utils/helpers');
		if (!helpers.areDeviceTypesCompatible(appDeviceType, optionDeviceType)) {
			throw new ExpectedError(
				`Device type ${
					options['device-type']
				} is incompatible with application ${options.application}`,
			);
		}
	}
}

async function askQuestionsForDeviceType(
	deviceType: BalenaSdk.DeviceType,
	options: FlagsDef,
	configJson?: import('../../utils/config').ImgConfig,
): Promise<Answers> {
	const form = await import('resin-cli-form');
	const helpers = await import('../../utils/helpers');
	const questions: any = deviceType.options;
	const answerSources: any[] = [options];
	const defaultAnswers: Partial<Answers> = {};

	console.log(
		`buildConfigForDeviceType questions:\n`,
		JSON.stringify(questions, null, 4),
		'\n',
	);

	if (!_.isEmpty(configJson)) {
		answerSources.push(configJson);
	}

	if (!options.advanced) {
		const advancedGroup: any = _.find(questions, {
			name: 'advanced',
			isGroup: true,
		});
		console.log('advancedGroup:\n', JSON.stringify(advancedGroup, null, 4));

		if (!_.isEmpty(advancedGroup)) {
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

	console.log(`defaultAnswers:\n`, JSON.stringify(defaultAnswers, null, 4));

	let extraOpts: { override: object } | undefined;

	if (!_.isEmpty(defaultAnswers)) {
		extraOpts = { override: defaultAnswers };
	}

	console.log('extraOpts:\n', JSON.stringify(extraOpts, null, 4));

	return form.run(questions, extraOpts);
}

function getQuestionNames(
	deviceType: BalenaSdk.DeviceType,
): Array<keyof Answers> {
	const questionNames: string[] = _.chain(deviceType.options)
		.flatMap(
			(group: BalenaSdk.DeviceTypeOptions) =>
				(group.isGroup && group.options) || [],
		)
		.map((groupOption: BalenaSdk.DeviceTypeOptionsGroup) => groupOption.name)
		.value();
	console.log(`questionNames:`, questionNames);
	return questionNames as Array<keyof Answers>;
}
