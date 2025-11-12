/*
Copyright 2016-2020 Balena Ltd.

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

import type { Application, BalenaSDK, Organization, Pine } from 'balena-sdk';

import {
	instanceOf,
	NotLoggedInError,
	ExpectedError,
	NotAvailableInOfflineModeError,
} from '../errors';
import { getBalenaSdk, stripIndent, getCliForm } from './lazy';
import validation = require('./validation');

export async function authenticate(options: object): Promise<void> {
	const balena = getBalenaSdk();
	const loginInfo = await getCliForm().run(
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
	);
	await balena.auth.login(loginInfo as Record<keyof typeof loginInfo, string>);
	const isTwoFactorAuthPassed = await balena.auth.twoFactor.isPassed();
	if (isTwoFactorAuthPassed) {
		return;
	}

	return getCliForm()
		.ask({
			message: 'Two factor auth challenge:',
			name: 'code',
			type: 'input',
		})
		.then(balena.auth.twoFactor.challenge)
		.catch((error: any) => {
			return balena.auth.logout().then(() => {
				if (error.name === 'BalenaRequestError' && error.statusCode === 401) {
					throw new ExpectedError('Invalid two factor authentication code');
				}
				throw error;
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
		Login required: use the “balena login” command to log in.
		`);
	}
}

/**
 * Throw NotLoggedInError if not logged in when condition true.
 *
 * @param {boolean} doCheck - will check if true.
 * @throws {NotLoggedInError}
 */
export const checkLoggedInIf = async (doCheck: boolean) => {
	if (doCheck) {
		await checkLoggedIn();
	}
};

/**
 * Throw NotAvailableInOfflineModeError if in offline mode.
 *
 * Called automatically if `onlineOnly=true`.
 * Can be called explicitly by command implementation, if e.g.:
 *  - check should only be done conditionally
 *  - other code needs to execute before check
 *
 *  Note, currently public to allow use outside of derived commands
 *  (as some command implementations require this. Can be made protected
 *  if this changes).
 *
 * @throws {NotAvailableInOfflineModeError}
 */
export const checkNotUsingOfflineMode = () => {
	if (process.env.BALENARC_OFFLINE_MODE) {
		throw new NotAvailableInOfflineModeError(stripIndent`
	This command requires an internet connection, and cannot be used in offline mode.
	To leave offline mode, unset the BALENARC_OFFLINE_MODE environment variable.
	`);
	}
};

export function askLoginType() {
	return getCliForm().ask<'web' | 'credentials' | 'token' | 'register'>({
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

export async function selectDeviceType() {
	const sdk = getBalenaSdk();
	let deviceTypes = await sdk.models.deviceType.getAllSupported();
	if (deviceTypes.length === 0) {
		// Without this open-balena users would get an empty list
		// until we add a hostApps import in open-balena.
		deviceTypes = await sdk.models.deviceType.getAll();
	}
	return getCliForm().ask({
		message: 'Device Type',
		type: 'list',
		choices: deviceTypes.map(({ slug: value, name }) => ({
			name,
			value,
		})),
	});
}

/**
 * Display interactive confirmation prompt.
 * Throw ExpectedError if the user declines.
 * @param yesOption - automatically confirm if true
 * @param message - message to display with prompt
 * @param yesMessage - message to display if automatically confirming
 */
export async function confirm(
	yesOption: boolean,
	message: string,
	yesMessage?: string,
	defaultValue = false,
) {
	if (yesOption) {
		if (yesMessage) {
			console.log(yesMessage);
		}
		return;
	}

	const confirmed = await getCliForm().ask<boolean>({
		message,
		type: 'confirm',
		default: defaultValue,
	});

	if (!confirmed) {
		throw new ExpectedError('Aborted');
	}
}

const selectApplicationPineOptions = {
	$select: ['id', 'slug', 'app_name'],
	$expand: {
		is_for__device_type: {
			$select: 'slug',
		},
	},
} as const;

type SelectApplicationResult = Pine.OptionsToResponse<
	Application['Read'],
	typeof selectApplicationPineOptions,
	undefined
>[number];

export async function selectApplication<
	T extends Pine.Filter<Application['Read']>,
>(
	filter?: T | ((app: SelectApplicationResult) => boolean),
	errorOnEmptySelection = false,
): Promise<SelectApplicationResult> {
	const balena = getBalenaSdk();
	let apps = await balena.models.application.getAllDirectlyAccessible({
		...selectApplicationPineOptions,
		...(filter != null && typeof filter === 'object' && { $filter: filter }),
	});

	if (!apps.length) {
		throw new ExpectedError('No fleets found');
	}

	if (filter != null && typeof filter === 'function') {
		apps = apps.filter(filter);
	}

	if (errorOnEmptySelection && apps.length === 0) {
		throw new ExpectedError('No suitable fleets found for selection');
	}
	return getCliForm().ask({
		message: 'Select an application',
		type: 'list',
		choices: apps.map((application) => ({
			name: `${application.app_name} (${application.slug}) [${application.is_for__device_type[0].slug}]`,
			value: application,
		})),
	});
}

export async function selectOrganization(
	organizations?: Array<Pick<Organization['Read'], 'handle' | 'name'>>,
) {
	// Use either provided orgs (if e.g. already loaded) or load from cloud
	organizations ??= await getBalenaSdk().models.organization.getAll({
		$select: ['name', 'handle'],
	});
	return getCliForm().ask({
		message: 'Select an organization',
		type: 'list',
		choices: organizations.map((org) => ({
			name: `${org.name} (${org.handle})`,
			value: org.handle,
		})),
	});
}

export async function getAndSelectOrganization() {
	const { getOwnOrganizations } = await import('./sdk');
	const organizations = await getOwnOrganizations(getBalenaSdk(), {
		$select: ['name', 'handle'],
	});

	if (organizations.length === 0) {
		// User is not a member of any organizations (should not happen).
		throw new Error('This account is not a member of any organizations');
	} else if (organizations.length === 1) {
		// User is a member of only one organization - use this.
		return organizations[0].handle;
	} else {
		// User is a member of multiple organizations -
		return selectOrganization(organizations);
	}
}

/*
 * Given fleetOrDevice, which may be
 *  - a fleet name
 *  - a fleet slug
 *  - a device uuid
 * Either:
 *  - in case of device uuid, return uuid of device after verifying that it exists and is online.
 *  - in case of fleet, return uuid of device user selects from list of online devices.
 */
export async function getOnlineTargetDeviceUuid(
	sdk: BalenaSDK,
	fleetOrDevice: string,
) {
	const logger = (await import('../utils/logger')).getLogger();

	// If looks like UUID, probably device
	if (validation.validateUuid(fleetOrDevice)) {
		try {
			logger.logDebug(
				`Trying to fetch device by UUID ${fleetOrDevice} (${typeof fleetOrDevice})`,
			);
			const device = await sdk.models.device.get(fleetOrDevice, {
				$select: ['uuid', 'is_online'],
			});

			if (!device.is_online) {
				throw new ExpectedError(
					`Device with UUID ${fleetOrDevice} is disconnected`,
				);
			}

			return device.uuid;
		} catch (err) {
			const { BalenaDeviceNotFound } = await import('balena-errors');
			if (instanceOf(err, BalenaDeviceNotFound)) {
				logger.logDebug(`Device with UUID ${fleetOrDevice} not found`);
				// Now try application
			} else {
				throw err;
			}
		}
	}

	// Not a device UUID, try application
	const application = await (async () => {
		try {
			logger.logDebug(`Fetching fleet ${fleetOrDevice}`);
			const { getApplication } = await import('./sdk');
			return await getApplication(sdk, fleetOrDevice, {
				$select: ['id', 'slug'],
				$expand: {
					owns__device: {
						$select: ['device_name', 'uuid'],
						$filter: { is_online: true },
						$orderby: { device_name: 'asc' },
					},
				},
			});
		} catch (err) {
			const { BalenaApplicationNotFound } = await import('balena-errors');
			if (instanceOf(err, BalenaApplicationNotFound)) {
				throw new ExpectedError(`Fleet or Device not found: ${fleetOrDevice}`);
			} else {
				throw err;
			}
		}
	})();

	// App found, load its devices
	const devices = application.owns__device;

	// Throw if no devices online
	if (!devices.length) {
		throw new ExpectedError(
			`Fleet ${application.slug} found, but has no devices online.`,
		);
	}

	// Ask user to select from online devices for fleet
	return getCliForm().ask({
		message: `Select a device on fleet ${application.slug}`,
		type: 'list',
		default: devices[0].uuid,
		choices: devices.map((device) => ({
			name: `${device.device_name || 'Untitled'} (${device.uuid.slice(0, 7)})`,
			value: device.uuid,
		})),
	});
}

export function selectFromList<T>(
	message: string,
	choices: Array<T & { name: string }>,
): Promise<T> {
	return getCliForm().ask<T>({
		message,
		type: 'list',
		choices: choices.map((s) => ({
			name: s.name,
			value: s,
		})),
	});
}
