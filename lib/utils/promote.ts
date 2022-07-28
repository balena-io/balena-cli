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
import type * as BalenaSdk from 'balena-sdk';

import { ExpectedError, printErrorMessage } from '../errors';
import { getVisuals, stripIndent, getCliForm } from './lazy';
import Logger = require('./logger');
import { confirm } from './patterns';
import { getLocalDeviceCmdStdout, getDeviceOsRelease } from './ssh';

const MIN_BALENAOS_VERSION = 'v2.14.0';

export async function join(
	logger: Logger,
	sdk: BalenaSdk.BalenaSDK,
	deviceHostnameOrIp?: string,
	appName?: string,
	appUpdatePollInterval?: number,
): Promise<void> {
	logger.logDebug('Determining device...');
	deviceHostnameOrIp = deviceHostnameOrIp || (await selectLocalDevice());
	await assertDeviceIsCompatible(deviceHostnameOrIp);
	logger.logDebug(`Using device: ${deviceHostnameOrIp}`);

	logger.logDebug('Determining device type...');
	const deviceType = await getDeviceType(deviceHostnameOrIp);
	logger.logDebug(`Device type: ${deviceType}`);

	logger.logDebug('Determining fleet...');
	const app = await getOrSelectApplication(sdk, deviceType, appName);
	logger.logDebug(
		`Using fleet: ${app.app_name} (${app.is_for__device_type[0].slug})`,
	);
	if (app.is_for__device_type[0].slug !== deviceType) {
		logger.logDebug(`Forcing device type to: ${deviceType}`);
		app.is_for__device_type[0].slug = deviceType;
	}

	logger.logDebug('Determining device OS version...');
	const deviceOsVersion = await getOsVersion(deviceHostnameOrIp);
	logger.logDebug(`Device OS version: ${deviceOsVersion}`);

	logger.logDebug('Generating fleet config...');
	const config = await generateApplicationConfig(sdk, app, {
		version: deviceOsVersion,
		appUpdatePollInterval,
	});
	logger.logDebug(`Using config: ${JSON.stringify(config, null, 2)}`);

	logger.logDebug('Configuring...');
	await configure(deviceHostnameOrIp, config);

	const platformUrl = await sdk.settings.get('balenaUrl');
	logger.logSuccess(`Device successfully joined ${platformUrl}!`);
}

export async function leave(
	logger: Logger,
	deviceHostnameOrIp?: string,
): Promise<void> {
	logger.logDebug('Determining device...');
	deviceHostnameOrIp = deviceHostnameOrIp || (await selectLocalDevice());
	await assertDeviceIsCompatible(deviceHostnameOrIp);
	logger.logDebug(`Using device: ${deviceHostnameOrIp}`);

	logger.logDebug('Deconfiguring...');
	await deconfigure(deviceHostnameOrIp);

	logger.logSuccess(stripIndent`
		Device successfully left the platform. The device will still be listed as part
		of the fleet, but changes to the fleet will no longer affect the device and its
		status will eventually be reported as 'Offline'. To irrecoverably delete the
		device from the fleet, use the 'balena device rm' command or delete it through
		the balenaCloud web dashboard.`);
}

async function execCommand(
	deviceIp: string,
	cmd: string,
	msg: string,
): Promise<void> {
	const { Writable } = await import('stream');
	const visuals = getVisuals();

	const spinner = new visuals.Spinner(`[${deviceIp}] Connecting...`);
	const innerSpinner = spinner.spinner;

	const stream = new Writable({
		write(_chunk: Buffer, _enc, callback) {
			innerSpinner.setSpinnerTitle(`%s [${deviceIp}] ${msg}`);
			callback();
		},
	});

	spinner.start();
	try {
		await getLocalDeviceCmdStdout(deviceIp, cmd, stream);
	} finally {
		spinner.stop();
	}
}

async function configure(deviceIp: string, config: any): Promise<void> {
	// Passing the JSON is slightly tricky due to the many layers of indirection
	// so we just base64-encode it here and decode it at the other end, when invoking
	// os-config.
	const json = JSON.stringify(config);
	const b64 = Buffer.from(json).toString('base64');
	const str = `"$(base64 -d <<< ${b64})"`;
	await execCommand(deviceIp, `os-config join ${str}`, 'Configuring...');
}

async function deconfigure(deviceIp: string): Promise<void> {
	await execCommand(deviceIp, 'os-config leave', 'Configuring...');
}

async function assertDeviceIsCompatible(deviceIp: string): Promise<void> {
	const cmd = 'os-config --version';
	try {
		await getLocalDeviceCmdStdout(deviceIp, cmd);
	} catch (err) {
		if (err instanceof ExpectedError) {
			throw err;
		}
		console.error(`${err}\n`);
		throw new ExpectedError(stripIndent`
			Failed to execute "${cmd}" on device "${deviceIp}".
			Depending on more specific error messages above, this may mean that the device
			is incompatible. Please ensure that the device is running a balenaOS release
			newer than ${MIN_BALENAOS_VERSION}.`);
	}
}

async function getDeviceType(deviceIp: string): Promise<string> {
	const output = await getDeviceOsRelease(deviceIp);
	const match = /^SLUG="([^"]+)"$/m.exec(output);
	if (!match) {
		throw new Error('Failed to determine device type');
	}
	return match[1];
}

async function getOsVersion(deviceIp: string): Promise<string> {
	const output = await getDeviceOsRelease(deviceIp);
	const match = /^VERSION_ID="([^"]+)"$/m.exec(output);
	if (!match) {
		throw new Error('Failed to determine OS version ID');
	}
	return match[1];
}

async function selectLocalDevice(): Promise<string> {
	const { forms } = await import('balena-sync');
	let hostnameOrIp;
	try {
		hostnameOrIp = await forms.selectLocalBalenaOsDevice();
		console.error(`==> Selected device: ${hostnameOrIp}`);
	} catch (e) {
		if (e.message.toLowerCase().includes('could not find any')) {
			throw new ExpectedError(e);
		} else {
			throw e;
		}
	}

	return hostnameOrIp;
}

async function selectAppFromList(
	applications: ApplicationWithDeviceType[],
): Promise<ApplicationWithDeviceType> {
	const _ = await import('lodash');
	const { selectFromList } = await import('../utils/patterns');

	// Present a list to the user which shows the fully qualified fleet
	// name (user/fleetname) and allows them to select.
	return selectFromList(
		'Select fleet',
		_.map(applications, (app) => {
			return { name: app.slug, ...app };
		}),
	);
}

async function getOrSelectApplication(
	sdk: BalenaSdk.BalenaSDK,
	deviceType: string,
	appName?: string,
): Promise<ApplicationWithDeviceType> {
	const _ = await import('lodash');

	const allDeviceTypes = await sdk.models.config.getDeviceTypes();
	const deviceTypeManifest = _.find(allDeviceTypes, { slug: deviceType });
	if (!deviceTypeManifest) {
		throw new ExpectedError(`"${deviceType}" is not a valid device type`);
	}
	const compatibleDeviceTypes = _(allDeviceTypes)
		.filter(
			(dt) =>
				sdk.models.os.isArchitectureCompatibleWith(
					deviceTypeManifest.arch,
					dt.arch,
				) &&
				!!dt.isDependent === !!deviceTypeManifest.isDependent &&
				dt.state !== 'DISCONTINUED',
		)
		.map((type) => type.slug)
		.value();

	if (!appName) {
		return createOrSelectApp(sdk, compatibleDeviceTypes, deviceType);
	}

	const options: BalenaSdk.PineOptions<BalenaSdk.Application> = {
		$expand: {
			is_for__device_type: { $select: 'slug' },
		},
	};

	// Check for a fleet slug of the form `user/fleet` and update the API query.
	let name: string;
	const match = appName.split('/');
	if (match.length > 1) {
		// These will match at most one fleet
		options.$filter = { slug: appName.toLowerCase() };
		name = match[1];
	} else {
		// We're given an application; resolve it if it's ambiguous and also validate
		// it's of appropriate device type.
		options.$filter = { app_name: appName };
		name = appName;
	}

	const applications = (await sdk.models.application.getAllDirectlyAccessible(
		options,
	)) as ApplicationWithDeviceType[];

	if (applications.length === 0) {
		await confirm(
			false,
			`No fleet found with name "${appName}".\n` +
				'Would you like to create it now?',
			undefined,
			true,
		);
		return await createApplication(sdk, deviceType, name);
	}

	// We've found at least one fleet with the given name.
	// Filter out fleets for non-matching device types and see what we're left with.
	const validApplications = applications.filter((app) =>
		_.includes(compatibleDeviceTypes, app.is_for__device_type[0].slug),
	);

	if (validApplications.length === 0) {
		throw new ExpectedError('No fleet found with a matching device type');
	}

	if (validApplications.length === 1) {
		return validApplications[0];
	}

	return selectAppFromList(applications);
}

async function createOrSelectApp(
	sdk: BalenaSdk.BalenaSDK,
	compatibleDeviceTypes: string[],
	deviceType: string,
): Promise<ApplicationWithDeviceType> {
	// No fleet specified, show a list to select one.
	const applications = (await sdk.models.application.getAllDirectlyAccessible({
		$expand: { is_for__device_type: { $select: 'slug' } },
		$filter: {
			is_for__device_type: {
				$any: {
					$alias: 'dt',
					$expr: { dt: { slug: { $in: compatibleDeviceTypes } } },
				},
			},
		},
	})) as ApplicationWithDeviceType[];

	if (applications.length === 0) {
		await confirm(
			false,
			'You have no fleets this device can join.\n' +
				'Would you like to create one now?',
			undefined,
			true,
		);
		return await createApplication(sdk, deviceType);
	}

	return selectAppFromList(applications);
}

async function createApplication(
	sdk: BalenaSdk.BalenaSDK,
	deviceType: string,
	name?: string,
): Promise<ApplicationWithDeviceType> {
	const validation = await import('./validation');

	const username = await sdk.auth.whoami();
	if (!username) {
		throw new sdk.errors.BalenaNotLoggedIn();
	}

	const applicationName = await new Promise<string>(async (resolve, reject) => {
		while (true) {
			try {
				const appName = await getCliForm().ask({
					message: 'Enter a name for your new fleet:',
					type: 'input',
					default: name,
					validate: validation.validateApplicationName,
				});

				try {
					await sdk.models.application.getDirectlyAccessible(appName, {
						$filter: {
							slug: { $startswith: `${username!.toLowerCase()}/` },
						},
					});
					// TODO: This is the only example in the codebase where `printErrorMessage()`
					//  is called directly.  Consider refactoring.
					printErrorMessage(
						'You already have a fleet with that name; please choose another.',
					);
					continue;
				} catch (err) {
					return resolve(appName);
				}
			} catch (err) {
				return reject(err);
			}
		}
	});

	const app = await sdk.models.application.create({
		name: applicationName,
		deviceType,
		organization: username,
	});
	return (await sdk.models.application.get(app.id, {
		$expand: {
			is_for__device_type: { $select: 'slug' },
		},
	})) as ApplicationWithDeviceType;
}

async function generateApplicationConfig(
	sdk: BalenaSdk.BalenaSDK,
	app: ApplicationWithDeviceType,
	options: {
		version: string;
		appUpdatePollInterval?: number;
	},
) {
	const { generateApplicationConfig: configGen } = await import('./config');

	const manifest = await sdk.models.device.getManifestBySlug(
		app.is_for__device_type[0].slug,
	);
	const opts =
		manifest.options &&
		manifest.options.filter((opt) => opt.name !== 'network');

	const override = {
		appUpdatePollInterval: options.appUpdatePollInterval,
	};

	const values = {
		...(opts ? await getCliForm().run(opts, { override }) : {}),
		...options,
	};

	const config = await configGen(app, values);
	if (config.connectivity === 'connman') {
		delete config.connectivity;
		delete config.files;
	}

	return config;
}
