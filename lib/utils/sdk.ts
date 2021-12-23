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
	Organization,
	PineOptions,
} from 'balena-sdk';

/**
 * Get a fleet object, disambiguating the fleet identifier which may be a
 * a fleet slug, name or numeric database ID (as a string).
 * TODO: add support for fleet UUIDs.
 */
export async function getApplication(
	sdk: BalenaSDK,
	nameOrSlugOrId: string | number,
	options?: PineOptions<Application>,
): Promise<Application> {
	const { looksLikeFleetSlug, looksLikeInteger } = await import('./validation');
	if (
		typeof nameOrSlugOrId === 'string' &&
		looksLikeFleetSlug(nameOrSlugOrId)
	) {
		return await sdk.models.application.getDirectlyAccessible(
			nameOrSlugOrId,
			options,
		);
	}
	if (typeof nameOrSlugOrId === 'number' || looksLikeInteger(nameOrSlugOrId)) {
		try {
			// Test for existence of app with this numerical ID
			return await sdk.models.application.getDirectlyAccessible(
				Number(nameOrSlugOrId),
				options,
			);
		} catch (e) {
			if (typeof nameOrSlugOrId === 'number') {
				throw e;
			}
			const { instanceOf } = await import('../errors');
			const { BalenaApplicationNotFound } = await import('balena-errors');
			if (!instanceOf(e, BalenaApplicationNotFound)) {
				throw e;
			}
			// App with this numerical ID not found, but there may be an app with this numerical name.
		}
	}
	// Not a slug and not a numeric database ID: must be an app name.
	// TODO: revisit this logic when we add support for fleet UUIDs.
	return await sdk.models.application.getAppByName(
		nameOrSlugOrId,
		options,
		'directly_accessible',
	);
}

/**
 * Given a fleet name, slug or numeric database ID, return its slug.
 * This function conditionally makes an async SDK/API call to retrieve the
 * application object, which can be wasteful if the application object is
 * required before or after the call to this function. If this is the case,
 * consider calling `getApplication()` and reusing the application object.
 */
export async function getFleetSlug(
	sdk: BalenaSDK,
	nameOrSlugOrId: string | number,
): Promise<string> {
	const { looksLikeFleetSlug } = await import('./validation');
	if (
		typeof nameOrSlugOrId === 'string' &&
		looksLikeFleetSlug(nameOrSlugOrId)
	) {
		return nameOrSlugOrId.toLowerCase();
	}
	return (await getApplication(sdk, nameOrSlugOrId)).slug;
}

/**
 * Wraps the sdk organization.getAll method,
 * restricting to those orgs user is a member of
 */
export async function getOwnOrganizations(
	sdk: BalenaSDK,
): Promise<Organization[]> {
	return await sdk.models.organization.getAll({
		$filter: {
			organization_membership: {
				$any: {
					$alias: 'orm',
					$expr: {
						orm: {
							user: await sdk.auth.getUserId(),
						},
					},
				},
			},
		},
		$orderby: 'name asc',
	});
}
