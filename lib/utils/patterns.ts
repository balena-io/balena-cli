/*
Copyright 2016-2019 Balena

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
import { BalenaApplicationNotFound } from 'balena-errors';
import * as BalenaSdk from 'balena-sdk';
import Bluebird = require('bluebird');
import { stripIndent } from 'common-tags';
import _ = require('lodash');
import _form = require('resin-cli-form');

import { instanceOf, NotLoggedInError } from '../errors';
import { getBalenaSdk, getChalk, getVisuals } from './lazy';
import messages = require('./messages');
import validation = require('./validation');

const getForm = _.once((): typeof _form => require('resin-cli-form'));

export function authenticate(options: {}): Bluebird<void> {
	const balena = getBalenaSdk();
	return getForm()
		.run(
			[
				{
					message: 'Email:',
					name: 'email',
					type: 'input',
					validate: validation.validateEmail,
				},
				{
					message: 'Password:',
					name: 'password',
					type: 'password',
				},
			],
			{ override: options },
		)
		.then(balena.auth.login)
		.then(balena.auth.twoFactor.isPassed)
		.then((isTwoFactorAuthPassed: boolean) => {
			if (isTwoFactorAuthPassed) {
				return;
			}

			return getForm()
				.ask({
					message: 'Two factor auth challenge:',
					name: 'code',
					type: 'input',
				})
				.then(balena.auth.twoFactor.challenge)
				.catch((error: any) => {
					return balena.auth.logout().then(() => {
						if (
							error.name === 'BalenaRequestError' &&
							error.statusCode === 401
						) {
							throw new Error('Invalid two factor authentication code');
						}
						throw error;
					});
				});
		});
}

/**
 * Check if logged in, and throw `NotLoggedInError` if not.
 * Note: `NotLoggedInError` is an `ExpectedError`.
 */
export async function checkLoggedIn(): Promise<void> {
	const balena = getBalenaSdk();
	if (!(await balena.auth.isLoggedIn())) {
		throw new NotLoggedInError(stripIndent`
			You have to log in to continue
			Run the following command to go through the login wizard:
				$ balena login`);
	}
}

/**
 * Check if logged in, and call `exitWithExpectedError()` if not.
 * DEPRECATED: Use checkLoggedIn() instead.
 */
export async function exitIfNotLoggedIn(): Promise<void> {
	try {
		await checkLoggedIn();
	} catch (error) {
		if (error instanceof NotLoggedInError) {
			exitWithExpectedError(error);
		} else {
			throw error;
		}
	}
}

export function askLoginType() {
	return getForm().ask<'web' | 'credentials' | 'token' | 'register'>({
		message: 'How would you like to login?',
		name: 'loginType',
		type: 'list',
		choices: [
			{
				name: 'Web authorization (recommended)',
				value: 'web',
			},
			{
				name: 'Credentials',
				value: 'credentials',
			},
			{
				name: 'Authentication token',
				value: 'token',
			},
			{
				name: "I don't have a balena account!",
				value: 'register',
			},
		],
	});
}

export function selectDeviceType() {
	return getBalenaSdk()
		.models.config.getDeviceTypes()
		.then(deviceTypes => {
			deviceTypes = _.sortBy(deviceTypes, 'name').filter(
				dt => dt.state !== 'DISCONTINUED',
			);
			return getForm().ask({
				message: 'Device Type',
				type: 'list',
				choices: _.map(deviceTypes, ({ slug: value, name }) => ({
					name,
					value,
				})),
			});
		});
}

export function confirm(
	yesOption: boolean,
	message: string,
	yesMessage?: string,
	exitIfDeclined = false,
) {
	return Bluebird.try(function() {
		if (yesOption) {
			if (yesMessage) {
				console.log(yesMessage);
			}
			return true;
		}

		return getForm().ask<boolean>({
			message,
			type: 'confirm',
			default: false,
		});
	}).then(function(confirmed) {
		if (!confirmed) {
			const err = new Error('Aborted');
			if (exitIfDeclined) {
				exitWithExpectedError(err);
			}
			throw err;
		}
	});
}

export function selectApplication(
	filter: (app: BalenaSdk.Application) => boolean,
) {
	const balena = getBalenaSdk();
	return balena.models.application
		.hasAny()
		.then(function(hasAnyApplications) {
			if (!hasAnyApplications) {
				throw new Error("You don't have any applications");
			}

			return balena.models.application.getAll();
		})
		.filter(filter || _.constant(true))
		.then(applications => {
			return getForm().ask({
				message: 'Select an application',
				type: 'list',
				choices: _.map(applications, application => ({
					name: `${application.app_name} (${application.device_type})`,
					value: application.app_name,
				})),
			});
		});
}

export function selectOrCreateApplication() {
	const balena = getBalenaSdk();
	return balena.models.application
		.hasAny()
		.then(hasAnyApplications => {
			if (!hasAnyApplications) {
				// Just to make TS happy
				return Promise.resolve(undefined);
			}

			return balena.models.application.getAll().then(applications => {
				const appOptions = _.map<
					BalenaSdk.Application,
					{ name: string; value: string | null }
				>(applications, application => ({
					name: `${application.app_name} (${application.device_type})`,
					value: application.app_name,
				}));

				appOptions.unshift({
					name: 'Create a new application',
					value: null,
				});

				return getForm().ask({
					message: 'Select an application',
					type: 'list',
					choices: appOptions,
				});
			});
		})
		.then(application => {
			if (application) {
				return application;
			}

			return getForm().ask({
				message: 'Choose a Name for your new application',
				type: 'input',
				validate: validation.validateApplicationName,
			});
		});
}

export function awaitDevice(uuid: string) {
	const balena = getBalenaSdk();
	return balena.models.device.getName(uuid).then(deviceName => {
		const visuals = getVisuals();
		const spinner = new visuals.Spinner(
			`Waiting for ${deviceName} to come online`,
		);

		const poll = (): Bluebird<void> => {
			return balena.models.device.isOnline(uuid).then(function(isOnline) {
				if (isOnline) {
					spinner.stop();
					console.info(`The device **${deviceName}** is online!`);
					return;
				} else {
					// Spinner implementation is smart enough to
					// not start again if it was already started
					spinner.start();

					return Bluebird.delay(3000).then(poll);
				}
			});
		};

		console.info(`Waiting for ${deviceName} to connect to balena...`);
		return poll().return(uuid);
	});
}

export function awaitDeviceOsUpdate(uuid: string, targetOsVersion: string) {
	const balena = getBalenaSdk();

	return balena.models.device.getName(uuid).then(deviceName => {
		const visuals = getVisuals();
		const progressBar = new visuals.Progress(
			`Updating the OS of ${deviceName} to v${targetOsVersion}`,
		);
		progressBar.update({ percentage: 0 });

		const poll = (): Bluebird<void> => {
			return Bluebird.all([
				balena.models.device.getOsUpdateStatus(uuid),
				balena.models.device.get(uuid, { $select: 'overall_progress' }),
			]).then(([osUpdateStatus, { overall_progress: osUpdateProgress }]) => {
				if (osUpdateStatus.status === 'done') {
					console.info(
						`The device ${deviceName} has been updated to v${targetOsVersion} and will restart shortly!`,
					);
					return;
				}

				if (osUpdateStatus.error) {
					console.error(
						`Failed to complete Host OS update on device ${deviceName}!`,
					);
					exitWithExpectedError(osUpdateStatus.error);
					return;
				}

				if (osUpdateProgress !== null) {
					// Avoid resetting to 0% at end of process when device goes offline.
					progressBar.update({ percentage: osUpdateProgress });
				}

				return Bluebird.delay(3000).then(poll);
			});
		};

		return poll().return(uuid);
	});
}

export function inferOrSelectDevice(preferredUuid: string) {
	const balena = getBalenaSdk();
	return balena.models.device
		.getAll()
		.filter<BalenaSdk.Device>(device => device.is_online)
		.then(onlineDevices => {
			if (_.isEmpty(onlineDevices)) {
				throw new Error("You don't have any devices online");
			}

			const defaultUuid = _(onlineDevices)
				.map('uuid')
				.includes(preferredUuid)
				? preferredUuid
				: onlineDevices[0].uuid;

			return getForm().ask({
				message: 'Select a device',
				type: 'list',
				default: defaultUuid,
				choices: _.map(onlineDevices, device => ({
					name: `${device.device_name || 'Untitled'} (${device.uuid.slice(
						0,
						7,
					)})`,
					value: device.uuid,
				})),
			});
		});
}

export async function getOnlineTargetUuid(
	sdk: BalenaSdk.BalenaSDK,
	applicationOrDevice: string,
) {
	const Logger = await import('../utils/logger');
	const logger = Logger.getLogger();
	const appTest = validation.validateApplicationName(applicationOrDevice);
	const uuidTest = validation.validateUuid(applicationOrDevice);

	if (!appTest && !uuidTest) {
		throw new Error(`Device or application not found: ${applicationOrDevice}`);
	}

	// if we have a definite device UUID...
	if (uuidTest && !appTest) {
		logger.logDebug(
			`Fetching device by UUID ${applicationOrDevice} (${typeof applicationOrDevice})`,
		);
		return (
			await sdk.models.device.get(applicationOrDevice, {
				$select: ['uuid'],
				$filter: { is_online: true },
			})
		).uuid;
	}

	// otherwise, it may be a device OR an application...
	try {
		logger.logDebug(
			`Fetching application by name ${applicationOrDevice} (${typeof applicationOrDevice})`,
		);
		const app = await sdk.models.application.get(applicationOrDevice);
		const devices = await sdk.models.device.getAllByApplication(app.id, {
			$filter: { is_online: true },
		});

		if (_.isEmpty(devices)) {
			throw new Error('No accessible devices are online');
		}

		return await getForm().ask({
			message: 'Select a device',
			type: 'list',
			default: devices[0].uuid,
			choices: _.map(devices, device => ({
				name: `${device.device_name || 'Untitled'} (${device.uuid.slice(
					0,
					7,
				)})`,
				value: device.uuid,
			})),
		});
	} catch (err) {
		if (!instanceOf(err, BalenaApplicationNotFound)) {
			throw err;
		}
		logger.logDebug(`Application not found`);
	}

	// it wasn't an application, maybe it's a device...
	logger.logDebug(
		`Fetching device by UUID ${applicationOrDevice} (${typeof applicationOrDevice})`,
	);
	return (
		await sdk.models.device.get(applicationOrDevice, {
			$select: ['uuid'],
			$filter: { is_online: true },
		})
	).uuid;
}

export function selectFromList<T>(
	message: string,
	choices: Array<T & { name: string }>,
): Bluebird<T> {
	return getForm().ask<T>({
		message,
		type: 'list',
		choices: _.map(choices, s => ({
			name: s.name,
			value: s,
		})),
	});
}

export function printErrorMessage(message: string) {
	const chalk = getChalk();
	console.error(chalk.red(message));
	console.error(chalk.red(`\n${messages.getHelp}\n`));
}

/**
 * Print a friendly error message and exit the CLI with an error code, BYPASSING
 * error reporting through Sentry.io's platform (raven.Raven.captureException).
 * Note that lib/errors.ts provides top-level error handling code to catch any
 * otherwise uncaught errors, AND to report them through Sentry.io. But many
 * "expected" errors (say, a JSON parsing error in a file provided by the user)
 * don't warrant reporting through Sentry.io.  For such mundane errors, catch
 * them and call this function.
 *
 * DEPRECATED: Use `throw new ExpectedError(<message>)` instead.
 */
export function exitWithExpectedError(message: string | Error): never {
	if (message instanceof Error) {
		({ message } = message);
	}

	printErrorMessage(message);
	process.exit(1);
}
