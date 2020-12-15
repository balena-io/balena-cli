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
