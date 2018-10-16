/*
Copyright 2016-2017 Resin.io

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

import _ = require('lodash');
import Promise = require('bluebird');
import form = require('resin-cli-form');
import visuals = require('resin-cli-visuals');
import resin = require('resin-sdk-preconfigured');
import chalk from 'chalk';
import validation = require('./validation');
import messages = require('./messages');

export function authenticate(options: {}): Promise<void> {
	return form
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
		.then(resin.auth.login)
		.then(resin.auth.twoFactor.isPassed)
		.then((isTwoFactorAuthPassed: boolean) => {
			if (isTwoFactorAuthPassed) {
				return;
			}

			return form
				.ask({
					message: 'Two factor auth challenge:',
					name: 'code',
					type: 'input',
				})
				.then(resin.auth.twoFactor.challenge)
				.catch((error: any) => {
					return resin.auth.logout().then(() => {
						if (
							error.name === 'ResinRequestError' &&
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
	return form.ask({
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
				name: "I don't have a Resin account!",
				value: 'register',
			},
		],
	});
}

export function selectDeviceType() {
	return resin.models.device.getSupportedDeviceTypes().then(deviceTypes => {
		return form.ask({
			message: 'Device Type',
			type: 'list',
			choices: deviceTypes,
		});
	});
}

export function confirm(
	yesOption: string,
	message: string,
	yesMessage: string,
) {
	return Promise.try(function() {
		if (yesOption) {
			if (yesMessage) {
				console.log(yesMessage);
			}
			return true;
		}

		return form.ask({
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

export function selectApplication(filter: (app: resin.Application) => boolean) {
	return resin.models.application
		.hasAny()
		.then(function(hasAnyApplications) {
			if (!hasAnyApplications) {
				throw new Error("You don't have any applications");
			}

			return resin.models.application.getAll();
		})
		.filter(filter || _.constant(true))
		.then(applications => {
			return form.ask({
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
	return resin.models.application
		.hasAny()
		.then(hasAnyApplications => {
			if (!hasAnyApplications) return;

			return resin.models.application.getAll().then(applications => {
				const appOptions = _.map<
					resin.Application,
					{ name: string; value: string | null }
				>(applications, application => ({
					name: `${application.app_name} (${application.device_type})`,
					value: application.app_name,
				}));

				appOptions.unshift({
					name: 'Create a new application',
					value: null,
				});

				return form.ask({
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

			return form.ask({
				message: 'Choose a Name for your new application',
				type: 'input',
				validate: validation.validateApplicationName,
			});
		});
}

export function awaitDevice(uuid: string) {
	return resin.models.device.getName(uuid).then(deviceName => {
		const spinner = new visuals.Spinner(
			`Waiting for ${deviceName} to come online`,
		);

		const poll = (): Promise<void> => {
			return resin.models.device.isOnline(uuid).then(function(isOnline) {
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

		console.info(`Waiting for ${deviceName} to connect to resin...`);
		return poll().return(uuid);
	});
}

export function inferOrSelectDevice(preferredUuid: string) {
	return resin.models.device
		.getAll()
		.filter<resin.Device>(device => device.is_online)
		.then(onlineDevices => {
			if (_.isEmpty(onlineDevices)) {
				throw new Error("You don't have any devices online");
			}

			const defaultUuid = _(onlineDevices)
				.map('uuid')
				.includes(preferredUuid)
				? preferredUuid
				: onlineDevices[0].uuid;

			return form.ask({
				message: 'Select a device',
				type: 'list',
				default: defaultUuid,
				choices: _.map(onlineDevices, device => ({
					name: `${device.name || 'Untitled'} (${device.uuid.slice(0, 7)})`,
					value: device.uuid,
				})),
			});
		});
}

export function selectFromList<T>(
	message: string,
	choices: Array<T & { name: string }>,
): Promise<T> {
	return form.ask({
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

export function exitWithExpectedError(message: string | Error) {
	if (message instanceof Error) {
		({ message } = message);
	}

	printErrorMessage(message);
	process.exit(1);
}
