import { stripIndent } from 'common-tags';
import { ResinSDK, Application } from 'resin-sdk';

import Logger = require('./logger');

import { runCommand } from './helpers';
import { exec, execBuffered } from './ssh';

const MIN_RESINOS_VERSION = 'v2.14.0';

export async function join(
	logger: Logger,
	sdk: ResinSDK,
	deviceHostnameOrIp?: string,
	appName?: string,
): Promise<void> {
	logger.logDebug('Checking login...');
	const isLoggedIn = await sdk.auth.isLoggedIn();
	if (!isLoggedIn) {
		logger.logInfo("Looks like you're not logged in yet!");
		logger.logInfo("Let's go through a quick wizard to get you started.\n");
		await runCommand('login');
	}

	logger.logDebug('Determining device...');
	const deviceIp = await getOrSelectLocalDevice(deviceHostnameOrIp);
	await assertDeviceIsCompatible(deviceIp);
	logger.logDebug(`Using device: ${deviceIp}`);

	logger.logDebug('Determining device type...');
	const deviceType = await getDeviceType(deviceIp);
	logger.logDebug(`Device type: ${deviceType}`);

	logger.logDebug('Determining application...');
	const app = await getOrSelectApplication(sdk, deviceType, appName);
	logger.logDebug(`Using application: ${app.app_name} (${app.device_type})`);
	if (app.device_type != deviceType) {
		logger.logDebug(`Forcing device type to: ${deviceType}`);
		app.device_type = deviceType;
	}

	logger.logDebug('Generating application config...');
	const config = await generateApplicationConfig(sdk, app);
	logger.logDebug(`Using config: ${JSON.stringify(config, null, 2)}`);

	logger.logDebug('Configuring...');
	await configure(deviceIp, config);
	logger.logDebug('All done.');

	const platformUrl = await sdk.settings.get('resinUrl');
	logger.logSuccess(`Device successfully joined ${platformUrl}!`);
}

export async function leave(
	logger: Logger,
	_sdk: ResinSDK,
	deviceHostnameOrIp?: string,
): Promise<void> {
	logger.logDebug('Determining device...');
	const deviceIp = await getOrSelectLocalDevice(deviceHostnameOrIp);
	await assertDeviceIsCompatible(deviceIp);
	logger.logDebug(`Using device: ${deviceIp}`);

	logger.logDebug('Deconfiguring...');
	await deconfigure(deviceIp);
	logger.logDebug('All done.');

	logger.logSuccess('Device successfully left the platform.');
}

async function execCommand(
	deviceIp: string,
	cmd: string,
	msg: string,
): Promise<void> {
	const through = await import('through2');
	const visuals = await import('resin-cli-visuals');

	const spinner = new visuals.Spinner(`[${deviceIp}] Connecting...`);
	const innerSpinner = spinner.spinner;

	const stream = through(function(data, _enc, cb) {
		innerSpinner.setSpinnerTitle(`%s [${deviceIp}] ${msg}`);
		cb(null, data);
	});

	spinner.start();
	await exec(deviceIp, cmd, stream);
	spinner.stop();
}

async function configure(deviceIp: string, config: any): Promise<void> {
	// Passing the JSON is slightly tricky due to the many layers of indirection
	// so we just base64-encode it here and decode it at the other end, when invoking
	// os-config.
	const json = JSON.stringify(config);
	const b64 = Buffer.from(json).toString('base64');
	const str = `"$(base64 -d <<< ${b64})"`;
	await execCommand(deviceIp, `os-config join '${str}'`, 'Configuring...');
}

async function deconfigure(deviceIp: string): Promise<void> {
	await execCommand(deviceIp, 'os-config leave', 'Configuring...');
}

async function assertDeviceIsCompatible(deviceIp: string): Promise<void> {
	const { exitWithExpectedError } = await import('../utils/patterns');
	try {
		await execBuffered(deviceIp, 'os-config --version');
	} catch (err) {
		exitWithExpectedError(stripIndent`
			Device "${deviceIp}" is incompatible and cannot join or leave an application.
			Please select or provision device with resinOS newer than ${MIN_RESINOS_VERSION}.`);
	}
}

async function getDeviceType(deviceIp: string): Promise<string> {
	const output = await execBuffered(deviceIp, 'cat /etc/os-release');
	const match = /^SLUG="([^"]+)"$/m.exec(output);
	if (!match) {
		throw new Error('Failed to determine device type');
	}
	return match[1];
}

async function getOrSelectLocalDevice(deviceIp?: string): Promise<string> {
	if (deviceIp) {
		return deviceIp;
	}

	const through = await import('through2');

	let ip: string | null = null;
	const stream = through(function(data, _enc, cb) {
		const match = /^==> Selected device: (.*)$/m.exec(data.toString());
		if (match) {
			ip = match[1];
			cb();
		} else {
			cb(null, data);
		}
	});

	stream.pipe(process.stderr);

	const { sudo } = await import('../utils/helpers');
	const command = process.argv.slice(0, 2).concat(['internal', 'scandevices']);
	await sudo(command, {
		stderr: stream,
		msg:
			'Scanning for local devices. If asked, please type your computer password.',
	});

	if (!ip) {
		throw new Error('No device selected');
	}

	return ip;
}

async function getOrSelectApplication(
	sdk: ResinSDK,
	deviceType: string,
	appName?: string,
): Promise<Application> {
	const _ = await import('lodash');
	const form = await import('resin-cli-form');
	const { selectFromList } = await import('../utils/patterns');

	const allDeviceTypes = await sdk.models.config.getDeviceTypes();
	const deviceTypeManifest = _.find(allDeviceTypes, { slug: deviceType });
	if (!deviceTypeManifest) {
		throw new Error(`"${deviceType}" is not a valid device type`);
	}
	const compatibleDeviceTypes = _(allDeviceTypes)
		.filter({ arch: deviceTypeManifest.arch })
		.map(type => type.slug)
		.value();

	const options: any = {
		$expand: { user: { $select: ['username'] } },
		$filter: { device_type: { $in: compatibleDeviceTypes } },
	};

	if (!appName) {
		// No application specified, show a list to select one.
		const applications = await sdk.models.application.getAll(options);
		if (applications.length === 0) {
			const shouldCreateApp = await form.ask({
				message:
					'You have no applications this device can join.\n' +
					'Would you like to create one now?',
				type: 'confirm',
				default: true,
			});
			if (shouldCreateApp) {
				return createApplication(sdk, deviceType);
			}
			process.exit(1);
		}
		return selectFromList(
			'Select application',
			_.map(applications, app => _.merge({ name: app.app_name }, app)),
		);
	}

	// We're given an application; resolve it if it's ambiguous and also validate
	// it's of appropriate device type.
	options.$filter = { app_name: appName };

	// Check for an app of the form `user/application` and update the API query.
	const match = appName.split('/');
	if (match.length > 1) {
		// These will match at most one app, so we'll return early.
		options.$expand.user.$filter = { username: match[0] };
		options.$filter.app_name = match[1];
	}

	// Fetch all applications with the given name that are accessible to the user
	const applications = await sdk.pine.get<Application>({
		resource: 'application',
		options,
	});

	if (applications.length === 0) {
		const shouldCreateApp = await form.ask({
			message:
				`No application found with name "${appName}".\n` +
				'Would you like to create it now?',
			type: 'confirm',
			default: true,
		});
		if (shouldCreateApp) {
			return createApplication(sdk, deviceType, options.$filter.app_name);
		}
		process.exit(1);
	}

	// We've found at least one app with the given name.
	// Filter out apps for non-matching device types and see what we're left with.
	const validApplications = applications.filter(app =>
		_.includes(compatibleDeviceTypes, app.device_type),
	);

	if (validApplications.length === 1) {
		return validApplications[0];
	}

	// If we got more than one application with the same name it means that the
	// user has access to a collab app with the same name as a personal app. We
	// present a list to the user which shows the fully qualified application
	// name (user/appname) and allows them to select
	return selectFromList(
		'Found multiple applications with that name; please select the one to use',
		_.map(validApplications, app => {
			const owner = _.get(app, 'user[0].username');
			return _.merge({ name: `${owner}/${app.app_name}` }, app);
		}),
	);
}

async function createApplication(
	sdk: ResinSDK,
	deviceType: string,
	name?: string,
): Promise<Application> {
	const form = await import('resin-cli-form');
	const validation = await import('./validation');
	const patterns = await import('./patterns');

	const user = await sdk.auth.getUserId();
	const queryOptions = {
		$filter: { user },
	};

	const appName = await new Promise<string>(async (resolve, reject) => {
		while (true) {
			try {
				const appName = await form.ask({
					message: 'Enter a name for your new application:',
					type: 'input',
					default: name,
					validate: validation.validateApplicationName,
				});

				try {
					await sdk.models.application.get(appName, queryOptions);
					patterns.printErrorMessage(
						'You already have an application with that name; please choose another.',
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

	return sdk.models.application.create({
		name: appName,
		deviceType,
	});
}

async function generateApplicationConfig(sdk: ResinSDK, app: Application) {
	const form = await import('resin-cli-form');
	const { generateApplicationConfig: configGen } = await import('./config');

	const manifest = await sdk.models.device.getManifestBySlug(app.device_type);
	const opts =
		manifest.options && manifest.options.filter(opt => opt.name !== 'network');
	const values = await form.run(opts);

	const config = await configGen(app, values);
	if (config.connectivity === 'connman') {
		delete config.connectivity;
		delete config.files;
	}

	return config;
}
