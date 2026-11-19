/**
 * @license
 * Copyright 2026 Balena Ltd.
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

/*
 * OS profile models, shaped as they are meant to land on balena-sdk:
 * `balena.models.application.profile`, `balena.models.device.profile` and
 * `balena.models.release.profile`. They hold the core logic of the profiles
 * model and are UI agnostic (they never print, and they throw balena-errors),
 * so that the CLI commands only parse arguments and format output.
 *
 * The profile resources (image_profile, application_profile_catalog,
 * application_profile & device_profile_override) only exist on the unversioned
 * `/resin/` model for now, so these models talk to it directly.
 *
 * TODO: Once profiles are part of a versioned model, move these to balena-sdk,
 * replace `getProfileModels()` with `getBalenaSdk().models` in the commands and
 * delete this file (and `resin-model.ts`).
 */

import type { BalenaSDK } from 'balena-sdk';
import {
	BalenaApplicationNotFound,
	BalenaDeviceNotFound,
	BalenaError,
	BalenaReleaseNotFound,
} from 'balena-errors';
import type {
	ODataOptionsWithoutCount,
	OptionsToResponse,
	PinejsClientCore,
} from 'pinejs-client-core';
import { getBalenaSdk } from './lazy';
import {
	getApplicationId,
	getDeviceId,
	getFleetHostApp,
	getReleaseId,
} from './sdk';
import type ResinModel from './resin-model';
import type {
	ApplicationProfile,
	ApplicationProfileCatalog,
	DeviceProfileOverride,
	ImageProfile,
} from './resin-model';

const isConflictError = (err: unknown) =>
	(err as { statusCode?: number })?.statusCode === 409;

export const getProfileModels = (sdk: BalenaSDK = getBalenaSdk()) => {
	// A clone of the SDK's pine client (sharing its auth & request backend)
	// targeting `/resin/` instead of `/v7/`, typed with that model
	const resinPine = sdk.pine.clone(
		{},
		{ apiVersion: 'resin' },
	) as unknown as PinejsClientCore<ResinModel>;

	/**
	 * Overrides can only exist for the OS application operating the device (an
	 * API rule), which completes the natural key of the device's overrides
	 */
	const getDeviceWithHostApp = async (uuidOrId: string | number) => {
		const device = await sdk.models.device.get(uuidOrId, {
			$select: ['id', 'uuid'],
			$expand: {
				should_be_operated_by__release: {
					$select: 'id',
					$expand: { belongs_to__application: { $select: ['id', 'slug'] } },
				},
			},
		});
		const hostApp =
			device.should_be_operated_by__release[0]?.belongs_to__application[0];
		return { device, hostApp };
	};

	/** Create or update the override of a profile on the OS app of a device */
	const setOverride = async (
		uuidOrId: string | number,
		profileName: string,
		isActive: boolean,
	): Promise<void> => {
		const { device, hostApp } = await getDeviceWithHostApp(uuidOrId);
		if (hostApp == null) {
			throw new BalenaError(
				`Device ${device.uuid} is not operated by any OS release`,
			);
		}
		const catalogEntry = await resinPine.get({
			resource: 'application_profile_catalog',
			id: { application: hostApp.id, catalogs__profile_name: profileName },
			options: { $select: 'id' },
		});
		if (catalogEntry == null) {
			throw new BalenaError(
				`Profile '${profileName}' is not provided by ${hostApp.slug}`,
			);
		}
		await resinPine.upsert({
			resource: 'device_profile_override',
			id: {
				device: device.id,
				overrides__profile_name: profileName,
				on__application: hostApp.id,
			},
			body: { is_active: isActive },
		});
	};

	return {
		application: {
			/**
			 * @namespace balena.models.application.profile
			 * @memberof balena.models.application
			 */
			profile: {
				/**
				 * @summary Get the profiles catalog of an (OS) application
				 * @name getCatalog
				 * @public
				 * @function
				 * @memberof balena.models.application.profile
				 *
				 * @description The profiles provided by the releases of an application,
				 * eg an OS application like `balena_os/raspberrypi5`.
				 *
				 * @param {String|Number} slugOrUuidOrId - application slug (string), uuid (string) or id (number)
				 * @param {Object} [options={}] - extra pine options to use
				 * @fulfil {Object[]} - application profile catalog entries
				 * @returns {Promise}
				 *
				 * @example
				 * balena.models.application.profile.getCatalog('balena_os/raspberrypi5').then(function(entries) {
				 * 	console.log(entries);
				 * });
				 */
				async getCatalog<
					T extends ODataOptionsWithoutCount<ApplicationProfileCatalog['Read']>,
				>(
					slugOrUuidOrId: string | number,
					options: T = {} as T,
				): Promise<
					OptionsToResponse<ApplicationProfileCatalog['Read'], T, undefined>
				> {
					const app = await resinPine.get({
						resource: 'application',
						id: await getApplicationId(sdk, slugOrUuidOrId),
						options: {
							$select: 'id',
							$expand: { application_profile_catalog: options },
						},
					});
					if (app == null) {
						throw new BalenaApplicationNotFound(slugOrUuidOrId);
					}
					return app.application_profile_catalog;
				},

				/**
				 * @summary Get the profile activations of a fleet
				 * @name getAllByApplication
				 * @public
				 * @function
				 * @memberof balena.models.application.profile
				 *
				 * @description The profiles activated for a fleet, one entry per OS
				 * application (`on__application`) they are activated on.
				 *
				 * @param {String|Number} slugOrUuidOrId - application slug (string), uuid (string) or id (number)
				 * @param {Object} [options={}] - extra pine options to use
				 * @fulfil {Object[]} - application profiles
				 * @returns {Promise}
				 *
				 * @example
				 * balena.models.application.profile.getAllByApplication('myorganization/myapp').then(function(activations) {
				 * 	console.log(activations);
				 * });
				 */
				async getAllByApplication<
					T extends ODataOptionsWithoutCount<ApplicationProfile['Read']>,
				>(
					slugOrUuidOrId: string | number,
					options: T = {} as T,
				): Promise<
					OptionsToResponse<ApplicationProfile['Read'], T, undefined>
				> {
					const app = await resinPine.get({
						resource: 'application',
						id: await getApplicationId(sdk, slugOrUuidOrId),
						options: {
							$select: 'id',
							// The `application_profile` alias resolves to the `on__application`
							// role (activations on the app as an OS application) instead of the
							// `application` one, so the verb-qualified form must be used
							$expand: { activates__profile_name__on__application: options },
						},
					});
					if (app == null) {
						throw new BalenaApplicationNotFound(slugOrUuidOrId);
					}
					return app.activates__profile_name__on__application;
				},

				/**
				 * @summary Activate a profile for a fleet
				 * @name activate
				 * @public
				 * @function
				 * @memberof balena.models.application.profile
				 *
				 * @description Activates the profile, as provided by the given OS
				 * application (or else by the only one operating the devices of the
				 * fleet), for the devices of the fleet operated by it. Devices
				 * overriding the profile are not affected.
				 *
				 * @param {String|Number} slugOrUuidOrId - application slug (string), uuid (string) or id (number)
				 * @param {String} profileName - profile name
				 * @param {String|Number} [hostAppSlugOrUuidOrId] - OS application slug (string), uuid (string) or id (number),
				 * optional for fleets whose devices are all operated by the same OS application
				 * @returns {Promise}
				 *
				 * @example
				 * balena.models.application.profile.activate('myorganization/myapp', 'profilename', 'balena_os/raspberrypi5');
				 */
				async activate(
					slugOrUuidOrId: string | number,
					profileName: string,
					hostAppSlugOrUuidOrId?: string | number,
				): Promise<void> {
					const appId = await getApplicationId(sdk, slugOrUuidOrId);
					const hostApp = await getFleetHostApp(
						sdk,
						appId,
						hostAppSlugOrUuidOrId,
					);
					const catalogEntry = await resinPine.get({
						resource: 'application_profile_catalog',
						id: {
							application: hostApp.id,
							catalogs__profile_name: profileName,
						},
						options: { $select: 'id' },
					});
					if (catalogEntry == null) {
						throw new BalenaError(
							`Profile '${profileName}' is not provided by ${hostApp.name}`,
						);
					}
					try {
						await resinPine.post({
							resource: 'application_profile',
							body: {
								application: appId,
								activates__profile_name: profileName,
								on__application: hostApp.id,
							},
						});
					} catch (err) {
						// Already active
						if (!isConflictError(err)) {
							throw err;
						}
					}
				},

				/**
				 * @summary Deactivate a profile for a fleet
				 * @name deactivate
				 * @public
				 * @function
				 * @memberof balena.models.application.profile
				 *
				 * @description Deactivates the profile, as provided by the given OS
				 * application (or else by the only one operating the devices of the
				 * fleet), for the devices of the fleet operated by it.
				 *
				 * @param {String|Number} slugOrUuidOrId - application slug (string), uuid (string) or id (number)
				 * @param {String} profileName - profile name
				 * @param {String|Number} [hostAppSlugOrUuidOrId] - OS application slug (string), uuid (string) or id (number),
				 * optional for fleets whose devices are all operated by the same OS application
				 * @returns {Promise}
				 *
				 * @example
				 * balena.models.application.profile.deactivate('myorganization/myapp', 'profilename', 'balena_os/raspberrypi5');
				 */
				async deactivate(
					slugOrUuidOrId: string | number,
					profileName: string,
					hostAppSlugOrUuidOrId?: string | number,
				): Promise<void> {
					const appId = await getApplicationId(sdk, slugOrUuidOrId);
					const hostApp = await getFleetHostApp(
						sdk,
						appId,
						hostAppSlugOrUuidOrId,
					);
					await resinPine.delete({
						resource: 'application_profile',
						id: {
							application: appId,
							activates__profile_name: profileName,
							on__application: hostApp.id,
						},
					});
				},
			},
		},

		device: {
			/**
			 * @namespace balena.models.device.profile
			 * @memberof balena.models.device
			 */
			profile: {
				/**
				 * @summary Get the profile overrides of a device
				 * @name getAllByDevice
				 * @public
				 * @function
				 * @memberof balena.models.device.profile
				 *
				 * @param {String|Number} uuidOrId - device uuid (string) or id (number)
				 * @param {Object} [options={}] - extra pine options to use
				 * @fulfil {Object[]} - device profile overrides
				 * @returns {Promise}
				 *
				 * @example
				 * balena.models.device.profile.getAllByDevice('7cf02a6').then(function(overrides) {
				 * 	console.log(overrides);
				 * });
				 */
				async getAllByDevice<
					T extends ODataOptionsWithoutCount<DeviceProfileOverride['Read']>,
				>(
					uuidOrId: string | number,
					options: T = {} as T,
				): Promise<
					OptionsToResponse<DeviceProfileOverride['Read'], T, undefined>
				> {
					const device = await resinPine.get({
						resource: 'device',
						id: await getDeviceId(sdk, uuidOrId),
						options: {
							$select: 'id',
							$expand: { device_profile_override: options },
						},
					});
					if (device == null) {
						throw new BalenaDeviceNotFound(uuidOrId);
					}
					return device.device_profile_override;
				},

				/**
				 * @summary Force a profile on for a device
				 * @name activate
				 * @public
				 * @function
				 * @memberof balena.models.device.profile
				 *
				 * @description Creates or updates the override of the profile on the OS
				 * application the device is operated by, regardless of the fleet setting.
				 *
				 * @param {String|Number} uuidOrId - device uuid (string) or id (number)
				 * @param {String} profileName - profile name
				 * @returns {Promise}
				 *
				 * @example
				 * balena.models.device.profile.activate('7cf02a6', 'profilename');
				 */
				activate: (uuidOrId: string | number, profileName: string) =>
					setOverride(uuidOrId, profileName, true),

				/**
				 * @summary Force a profile off for a device
				 * @name deactivate
				 * @public
				 * @function
				 * @memberof balena.models.device.profile
				 *
				 * @description Creates or updates the override of the profile on the OS
				 * application the device is operated by, regardless of the fleet setting.
				 *
				 * @param {String|Number} uuidOrId - device uuid (string) or id (number)
				 * @param {String} profileName - profile name
				 * @returns {Promise}
				 *
				 * @example
				 * balena.models.device.profile.deactivate('7cf02a6', 'profilename');
				 */
				deactivate: (uuidOrId: string | number, profileName: string) =>
					setOverride(uuidOrId, profileName, false),

				/**
				 * @summary Remove the override of a profile from a device
				 * @name removeOverride
				 * @public
				 * @function
				 * @memberof balena.models.device.profile
				 *
				 * @description The device reverts to the fleet setting for the profile.
				 *
				 * @param {String|Number} uuidOrId - device uuid (string) or id (number)
				 * @param {String} profileName - profile name
				 * @returns {Promise}
				 *
				 * @example
				 * balena.models.device.profile.removeOverride('7cf02a6', 'profilename');
				 */
				async removeOverride(
					uuidOrId: string | number,
					profileName: string,
				): Promise<void> {
					const { device, hostApp } = await getDeviceWithHostApp(uuidOrId);
					// Devices not operated by any OS release cannot have overrides
					if (hostApp == null) {
						return;
					}
					await resinPine.delete({
						resource: 'device_profile_override',
						id: {
							device: device.id,
							overrides__profile_name: profileName,
							on__application: hostApp.id,
						},
					});
				},
			},
		},

		release: {
			/**
			 * @namespace balena.models.release.profile
			 * @memberof balena.models.release
			 */
			profile: {
				/**
				 * @summary Get the image profiles of a release
				 * @name getAllByRelease
				 * @public
				 * @function
				 * @memberof balena.models.release.profile
				 *
				 * @description The profiles the images (services) of a release are
				 * tagged with, one entry per image and profile.
				 *
				 * @param {String|Number} commitOrId - release commit (string) or id (number)
				 * @param {Object} [options={}] - extra pine options to use
				 * @fulfil {Object[]} - image profiles
				 * @returns {Promise}
				 *
				 * @example
				 * balena.models.release.profile.getAllByRelease(123).then(function(imageProfiles) {
				 * 	console.log(imageProfiles);
				 * });
				 */
				async getAllByRelease<
					T extends ODataOptionsWithoutCount<ImageProfile['Read']>,
				>(
					commitOrId: string | number,
					options: T = {} as T,
				): Promise<OptionsToResponse<ImageProfile['Read'], T, undefined>> {
					const release = await resinPine.get({
						resource: 'release',
						id: await getReleaseId(sdk, commitOrId),
						options: {
							$select: 'id',
							$expand: {
								release_image: {
									$select: 'id',
									$expand: { image_profile: options },
								},
							},
						},
					});
					if (release == null) {
						throw new BalenaReleaseNotFound(commitOrId);
					}
					// TS cannot infer the flattened element type of the generic response
					return release.release_image.flatMap(
						(ri) => ri.image_profile,
					) as OptionsToResponse<ImageProfile['Read'], T, undefined>;
				},
			},
		},
	};
};
