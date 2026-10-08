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
import { Args } from '@oclif/core';
import { lowercaseIfSlug } from './normalization';

export const fleetRequired = Args.string({
	description: 'fleet name or slug (preferred)',
	required: true,
	parse: lowercaseIfSlug,
});

export const fleetOrIdRequired = Args.custom<string | number>({
	description: 'fleet name, slug (preferred) or numeric ID',
	parse: async (input) =>
		/^\d+$/.test(input) ? Number(input) : lowercaseIfSlug(input),
})({ required: true });

/** Same validation the API applies to profile names */
const PROFILE_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_.-]+$/;

/** Parse a comma-separated list of profile names */
export async function parseProfileNames(input: string): Promise<string[]> {
	const { ExpectedError } = await import('../errors');
	const names = input.split(',').filter((s) => s !== '');
	if (names.length === 0) {
		throw new ExpectedError('At least one profile name must be provided');
	}
	for (const name of names) {
		if (!PROFILE_NAME_REGEX.test(name)) {
			throw new ExpectedError(`Invalid profile name "${name}"`);
		}
	}
	return [...new Set(names)];
}

export const profileNamesRequired = Args.custom<string[]>({
	description: 'comma-separated list (no blank spaces) of profile names',
	parse: parseProfileNames,
})({ required: true });
