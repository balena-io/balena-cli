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

import type { Application, BalenaSDK, PineOptions } from 'balena-sdk';

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
	// TODO: Consider whether it would be useful to generally include interactive selection of application here,
	//       when nameOrSlugOrId not provided.
	//       e.g. nameOrSlugOrId || (await (await import('../../utils/patterns')).selectApplication()),
	//       See commands/device/init.ts ~ln100 for example
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
