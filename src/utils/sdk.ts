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

import type { Application, BalenaSDK, Organization, Pine } from 'balena-sdk';

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
