/**
 * @license
 * Copyright 2020 Balena Ltd.
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

import type {
	Application,
	BalenaSDK,
	Device,
	Organization,
	Pine,
	Release,
} from 'balena-sdk';
import { validateLongUuid } from './validation';

/** provides backwards compatibility for querying using short commit hashes */
export async function getRelease<
	T extends Pine.ODataOptionsWithoutCount<Release['Read']>,
>(
	commitOrIdOrRawVersion: Parameters<BalenaSDK['models']['release']['get']>[0],
	options?: T,
): Promise<Pine.OptionsToResponse<Release['Read'], T, undefined>[number]> {
	const { getBalenaSdk } = await import('./lazy');
	const sdk = getBalenaSdk();
	return $getRelease(sdk, commitOrIdOrRawVersion, options);
}

// The only reason we export a separate $getRelease method is to make the disambiguateReleaseParam tests easier
export async function $getRelease<
	T extends Pine.ODataOptionsWithoutCount<Release['Read']>,
>(
	sdk: BalenaSDK,
	commitOrIdOrRawVersion: Parameters<BalenaSDK['models']['release']['get']>[0],
	options?: T,
): Promise<Pine.OptionsToResponse<Release['Read'], T, undefined>[number]> {
	// Handle the case that a short commit might be passed
	if (
		typeof commitOrIdOrRawVersion === 'string' &&
		commitOrIdOrRawVersion.length > 0
	) {
		const releases = (await sdk.pine.get({
			resource: 'release',
			options: sdk.utils.mergePineOptions(
				{
					$filter: {
						commit: { $startswith: commitOrIdOrRawVersion },
					},
				},
				options,
			),
		})) as Pine.OptionsToResponse<Release['Read'], T, undefined>;
		if (releases.length === 0) {
			throw new sdk.errors.BalenaReleaseNotFound(commitOrIdOrRawVersion);
		}
		if (releases.length > 1) {
			throw new sdk.errors.BalenaAmbiguousRelease(commitOrIdOrRawVersion);
		}
		return releases[0];
	}
	return await sdk.models.release.get(commitOrIdOrRawVersion, options);
}

const isFullUuid = (v?: unknown): v is string & { length: 32 | 62 } =>
	typeof v === 'string' && validateLongUuid(v);

/** provides backwards compatibility for querying using short uuids hashes */
export async function getDevice<
	T extends Pine.ODataOptionsWithoutCount<Device['Read']>,
>(
	uuidOrId: string | number,
	options?: T,
): Promise<Pine.OptionsToResponse<Device['Read'], T, undefined>[number]> {
	const { getBalenaSdk } = await import('./lazy');
	const sdk = getBalenaSdk();
	if (
		typeof uuidOrId === 'string' &&
		uuidOrId.length > 0 &&
		!isFullUuid(uuidOrId)
	) {
		const devices = (await sdk.pine.get({
			resource: 'device',
			options: sdk.utils.mergePineOptions(
				{
					$filter: {
						uuid: { $startswith: uuidOrId },
					},
				},
				options,
			),
		})) as Pine.OptionsToResponse<Device['Read'], T, undefined>;
		if (devices.length > 1) {
			throw new sdk.errors.BalenaAmbiguousDevice(uuidOrId);
		}
		const device = devices[0];
		if (device == null) {
			throw new sdk.errors.BalenaDeviceNotFound(uuidOrId);
		}
		return device;
	}
	return await sdk.models.device.get(uuidOrId, options);
}

export async function resolveDeviceUuidParam<T extends string | number>(
	uuidOrId: T,
): Promise<string> {
	if (isFullUuid(uuidOrId)) {
		return uuidOrId;
	}
	return (await getDevice(uuidOrId, { $select: 'uuid' })).uuid;
}

// Atm we are just resolving all partial UUIDs in one go.
// Combining to a single request and confirming ambiguities is left for a follow-up if needed.
export async function resolveDeviceUuidsParam(
	uuids: string[],
): Promise<string[]> {
	const fullUuids: string[] = [];
	for (const uuid of uuids) {
		if (isFullUuid(uuid)) {
			fullUuids.push(uuid);
		} else {
			fullUuids.push((await getDevice(uuid, { $select: 'uuid' })).uuid);
		}
	}
	return fullUuids;
}

export async function getApplication<
	TP extends Pine.ODataOptionsWithoutCount<Application['Read']>,
>(
	sdk: BalenaSDK,
	nameOrSlugOrId: string | number,
	options: TP,
): Promise<
	NonNullable<
		Pine.OptionsToResponse<Application['Read'], TP, typeof nameOrSlugOrId>
	>
>;
/**
 * Get a fleet object, disambiguating the fleet identifier which may be a
 * a fleet slug or name.
 * TODO: add support for fleet UUIDs.
 */
export async function getApplication(
	sdk: BalenaSDK,
	nameOrSlugOrId: string | number,
	options?: Pine.ODataOptionsWithoutCount<Application['Read']>,
) {
	const { looksLikeFleetSlug } = await import('./validation');
	const whoamiResult = await sdk.auth.whoami();
	const isDeviceActor = whoamiResult?.actorType === 'device';

	if (isDeviceActor) {
		const $filterByActor = {
			$filter: {
				owns__device: {
					$any: {
						$alias: 'd',
						$expr: {
							d: {
								actor: whoamiResult.id,
							},
						},
					},
				},
			},
		};
		options = options
			? sdk.utils.mergePineOptions(options, $filterByActor)
			: $filterByActor;
	}

	if (
		typeof nameOrSlugOrId === 'string' &&
		!looksLikeFleetSlug(nameOrSlugOrId)
	) {
		// Not a slug: must be an app name.
		// TODO: revisit this logic when we add support for fleet UUIDs.
		return await sdk.models.application.getAppByName(
			nameOrSlugOrId,
			options,
			isDeviceActor ? undefined : 'directly_accessible',
		);
	}

	const getFunction = isDeviceActor
		? sdk.models.application.get
		: sdk.models.application.getDirectlyAccessible;

	return getFunction(nameOrSlugOrId, options);
}

/**
 * Given a fleet name or slug, return its slug.
 * This function conditionally makes an async SDK/API call to retrieve the
 * application object, which can be wasteful if the application object is
 * required before or after the call to this function. If this is the case,
 * consider calling `getApplication()` and reusing the application object.
 */
export async function getFleetSlug(
	sdk: BalenaSDK,
	nameOrSlug: string,
): Promise<string> {
	const { looksLikeFleetSlug } = await import('./validation');
	if (!looksLikeFleetSlug(nameOrSlug)) {
		// Not a slug: must be an app name.
		// TODO: revisit this logic when we add support for fleet UUIDs.
		return (await getApplication(sdk, nameOrSlug, { $select: 'slug' })).slug;
	}
	return nameOrSlug.toLowerCase();
}

export async function getOwnOrganizations<
	TP extends Pine.ODataOptionsWithoutCount<Organization['Read']>,
>(
	sdk: BalenaSDK,
	options: TP,
): Promise<Pine.OptionsToResponse<Organization['Read'], TP, undefined>>;

/**
 * Wraps the sdk organization.getAll method,
 * restricting to those orgs user is a member of
 */
export async function getOwnOrganizations(
	sdk: BalenaSDK,
	options?: Pine.ODataOptionsWithoutCount<Organization['Read']>,
) {
	return await sdk.models.organization.getAll(
		sdk.utils.mergePineOptions(
			{
				$filter: {
					organization_membership: {
						$any: {
							$alias: 'orm',
							$expr: {
								orm: {
									user: (await sdk.auth.getUserInfo()).id,
								},
							},
						},
					},
				},
				$orderby: { name: 'asc' },
			},
			options,
		),
	);
}
