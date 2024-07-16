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

import type {
	Application,
	BalenaSDK,
	Device,
	Organization,
	PineFilter,
	PineOptions,
	PineTypedResult,
} from 'balena-sdk';

import { instanceOf, NotLoggedInError, ExpectedError } from '../errors.js';
import { getBalenaSdk, getVisuals, stripIndent, getCliForm } from './lazy.js';
import * as validation from './validation.js';
import { delay } from './helpers.js';
import type Bluebird from 'bluebird';

export function authenticate(options: object): Bluebird<void> {
	const balena = getBalenaSdk();
	return getCliForm()
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

			return getCliForm()
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
							throw new ExpectedError('Invalid two factor authentication code');
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
		Login required: use the “balena login” command to log in.
		`);
	}
}

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
} satisfies PineOptions<Application>;

type SelectApplicationResult = PineTypedResult<
	Application,
	typeof selectApplicationPineOptions
>;

export async function selectApplication(
	filter?:
		| PineFilter<Application>
		| ((app: SelectApplicationResult) => boolean),
	errorOnEmptySelection = false,
) {
	const balena = getBalenaSdk();
	let apps = (await balena.models.application.getAllDirectlyAccessible({
		...selectApplicationPineOptions,
		...(filter != null && typeof filter === 'object' && { $filter: filter }),
	})) as SelectApplicationResult[];

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
	organizations?: Array<Pick<Organization, 'handle' | 'name'>>,
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
	const { getOwnOrganizations } = await import('./sdk.js');
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

export async function awaitDeviceOsUpdate(
	uuid: string,
	targetOsVersion: string,
) {
	const balena = getBalenaSdk();

	const deviceName = await balena.models.device.getName(uuid);
	const visuals = getVisuals();
	const progressBar = new visuals.Progress(
		`Updating the OS of ${deviceName} to v${targetOsVersion}`,
	);
	progressBar.update({ percentage: 0 });

	const poll = async (): Promise<void> => {
		const [osUpdateStatus, { overall_progress: osUpdateProgress }] =
			await Promise.all([
				balena.models.device.getOsUpdateStatus(uuid),
				balena.models.device.get(uuid, { $select: 'overall_progress' }),
			]);
		if (osUpdateStatus.status === 'done') {
			console.info(
				`The device ${deviceName} has been updated to v${targetOsVersion} and will restart shortly!`,
			);
			return;
		}

		if (osUpdateStatus.error) {
			throw new ExpectedError(
				`Failed to complete Host OS update on device ${deviceName}\n${osUpdateStatus.error}`,
			);
		}

		if (osUpdateProgress !== null) {
			// Avoid resetting to 0% at end of process when device goes offline.
			progressBar.update({ percentage: osUpdateProgress });
		}

		await delay(3000);
		await poll();
	};

	await poll();
	return uuid;
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
	const Logger = await import('../utils/logger.js');
	const logger = Logger.default.getLogger();

	// If looks like UUID, probably device
	if (validation.validateUuid(fleetOrDevice)) {
		let device: Device;
		try {
			logger.logDebug(
				`Trying to fetch device by UUID ${fleetOrDevice} (${typeof fleetOrDevice})`,
			);
			device = await sdk.models.device.get(fleetOrDevice, {
				$select: ['uuid', 'is_online'],
			});

			if (!device.is_online) {
				throw new ExpectedError(`Device with UUID ${fleetOrDevice} is offline`);
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
			const { getApplication } = await import('./sdk.js');
			return await getApplication(sdk, fleetOrDevice, {
				$select: ['id', 'slug'],
				$expand: {
					owns__device: {
						$select: ['device_name', 'uuid'],
						$filter: { is_online: true },
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
): Bluebird<T> {
	return getCliForm().ask<T>({
		message,
		type: 'list',
		choices: choices.map((s) => ({
			name: s.name,
			value: s,
		})),
	});
}
