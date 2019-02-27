/*
Copyright 2016-2017 Balena

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
import _form = require('resin-cli-form');
import _visuals = require('resin-cli-visuals');

import _ = require('lodash');
import Promise = require('bluebird');
import BalenaSdk = require('balena-sdk');
import chalk from 'chalk';
import validation = require('./validation');
import messages = require('./messages');

const getBalenaSdk = _.once(() => BalenaSdk.fromSharedOptions());

const getForm = _.once((): typeof _form => require('resin-cli-form'));
const getVisuals = _.once((): typeof _visuals => require('resin-cli-visuals'));

export function authenticate(options: {}): Promise<void> {
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

export function askLoginType() {
	return getForm().ask({
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
			deviceTypes = _.sortBy(deviceTypes, 'name');
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
) {
	return Promise.try(function() {
		if (yesOption) {
			if (yesMessage) {
				console.log(yesMessage);
			}
			return true;
		}

		return getForm().ask({
			message,
			type: 'confirm',
			default: false,
		});
	}).then(function(confirmed) {
		if (!confirmed) {
			throw new Error('Aborted');
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
			if (!hasAnyApplications) return;

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

		const poll = (): Promise<void> => {
			return balena.models.device.isOnline(uuid).then(function(isOnline) {
				if (isOnline) {
					spinner.stop();
					console.info(`The device **${deviceName}** is online!`);
					return;
				} else {
					// Spinner implementation is smart enough to
					// not start again if it was already started
					spinner.start();

					return Promise.delay(3000).then(poll);
				}
			});
		};

		console.info(`Waiting for ${deviceName} to connect to balena...`);
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

export function selectFromList<T>(
	message: string,
	choices: Array<T & { name: string }>,
): Promise<T> {
	return getForm().ask({
		message,
		type: 'list',
		choices: _.map(choices, s => ({
			name: s.name,
			value: s,
		})),
	});
}

export function printErrorMessage(message: string) {
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
 */
export function exitWithExpectedError(message: string | Error): never {
	if (message instanceof Error) {
		({ message } = message);
	}

	printErrorMessage(message);
	process.exit(1);
	// The following throw is to make tsc happy about the `never` return type.
	throw new Error('exit');
}
