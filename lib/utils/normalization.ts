/**
 * @license
 * Copyright 2016-2020 Balena Ltd.
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

import type { BalenaSDK } from 'balena-sdk';
import { ExpectedError } from '../errors.js';

/**
 * Takes a string which may represent one of:
 * 	- Integer release id
 *  - String uuid, 7, 32, or 62 char
 *  - String commit hash, 40 char, with short hashes being 7+ chars (more as needed to avoid collisions)
 * and returns the correctly typed value (integer|string).
 * @param balena balena sdk
 * @param release string representation of release reference (id/hash)
 */
export async function disambiguateReleaseParam(
	balena: BalenaSDK,
	release: string,
) {
	// Reject empty values or invalid characters
	const mixedCaseHex = /^[a-fA-F0-9]+$/;
	if (!release || !mixedCaseHex.test(release)) {
		throw new ExpectedError('Invalid release parameter');
	}

	// Accepting short hashes of 7,8,9 chars.
	const possibleUuidHashLength = [7, 8, 9, 32, 40, 62].includes(release.length);
	const hasLeadingZero = release[0] === '0';
	const isOnlyNumerical = /^[0-9]+$/.test(release);

	// Reject non-numerical values with invalid uuid/hash lengths
	if (!isOnlyNumerical && !possibleUuidHashLength) {
		throw new ExpectedError('Invalid release parameter');
	}

	// Reject leading-zero values with invalid uuid/hash lengths
	if (hasLeadingZero && !possibleUuidHashLength) {
		throw new ExpectedError('Invalid release parameter');
	}

	// If alphanumeric, or has leading zero must now be uuid/hash.
	if (!isOnlyNumerical || hasLeadingZero) {
		return release;
	}

	// Now very likely an integer id (but still could be number only uuid/hash)
	// Check integer id with API
	try {
		return (
			await balena.models.release.get(parseInt(release, 10), {
				$select: 'id',
			})
		).id;
	} catch (e) {
		if (e.name !== 'BalenaReleaseNotFound') {
			throw e;
		}
	}

	// Must be a number only uuid/hash (or nonexistent release)
	return (await balena.models.release.get(release, { $select: 'id' })).id;
}

/**
 * Convert to lowercase if looks like slug
 */
export async function lowercaseIfSlug(s: string) {
	return s.includes('/') ? s.toLowerCase() : s;
}

export function normalizeOsVersion(version: string) {
	// Note that `version` may also be 'latest', 'recommended', 'default'
	if (/^v?\d+\.\d+\.\d+/.test(version)) {
		if (version[0] === 'v') {
			version = version.slice(1);
		}
	}
	return version;
}
