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
 * Wraps the sdk application.get method,
 * adding disambiguation in cases where the provided
 * identifier could be interpreted in multiple valid ways.
 */
export async function getApplication(
	sdk: BalenaSDK,
	nameOrSlugOrId: string | number,
	options?: PineOptions<Application>,
): Promise<Application> {
	const { looksLikeInteger } = await import('./validation');
	if (looksLikeInteger(nameOrSlugOrId as string)) {
		try {
			// Test for existence of app with this numerical ID
			return await sdk.models.application.get(Number(nameOrSlugOrId), options);
		} catch (e) {
			const { instanceOf } = await import('../errors');
			const { BalenaApplicationNotFound } = await import('balena-errors');
			if (!instanceOf(e, BalenaApplicationNotFound)) {
				throw e;
			}
			// App with this numerical ID not found, but there may be an app with this numerical name.
		}
	}
	return sdk.models.application.get(nameOrSlugOrId, options);
}

/**
 * Given a fleet name, slug or numeric ID, return its slug.
 * This function conditionally makes an async SDK/API call to retrieve the
 * application object, which can be wasteful is the application object is
 * required before or after the call to this function. If this is the case,
 * consider calling `getApplication()` and reusing the application object.
 */
export async function getFleetSlug(
	sdk: BalenaSDK,
	nameOrSlugOrId: string | number,
): Promise<string> {
	if (typeof nameOrSlugOrId === 'string' && nameOrSlugOrId.includes('/')) {
		return nameOrSlugOrId;
	}
	return (await getApplication(sdk, nameOrSlugOrId)).slug;
}

/**
 * Given an string representation of an application identifier,
 * which could be one of:
 *  - name (including numeric names)
 *  - slug
 *  - numerical id
 *  disambiguate and return a properly typed identifier.
 *
 *  Attempts to minimise the number of API calls required.
 * TODO: Remove this once support for numeric App IDs is removed.
 */
export async function getTypedApplicationIdentifier(
	sdk: BalenaSDK,
	nameOrSlugOrId: string,
) {
	const { looksLikeInteger } = await import('./validation');
	// If there's no possible ambiguity,
	// return the passed identifier unchanged
	if (!looksLikeInteger(nameOrSlugOrId)) {
		return nameOrSlugOrId;
	}

	// Resolve ambiguity
	try {
		// Test for existence of app with this numerical ID,
		// and return typed id if found
		return (await sdk.models.application.get(Number(nameOrSlugOrId))).id;
	} catch (e) {
		const { instanceOf } = await import('../errors');
		const { BalenaApplicationNotFound } = await import('balena-errors');
		if (!instanceOf(e, BalenaApplicationNotFound)) {
			throw e;
		}
	}

	// App with this numerical id not found
	// return the passed identifier unchanged
	return nameOrSlugOrId;
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
