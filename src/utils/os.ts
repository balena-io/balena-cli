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

import type * as SDK from 'balena-sdk';
import { getBalenaSdk, getCliForm, getVisuals } from './lazy';

import { ExpectedError } from '../errors';

/**
 * Heuristically determine whether the given semver version is a balenaOS
 * ESR version.
 *
 * @param {string} version Semver version. If invalid or range, return false.
 */
export const isESR = (version: string) => {
	const match = version.match(/^v?(\d+)\.\d+\.\d+/);
	const major = parseInt(match?.[1] ?? '', 10);
	return major >= 2018; // note: (NaN >= 2018) is false
};

/**
 * Returns whether the OS version is 'esr' or 'default'
 */
export const getOsType = (version: string) =>
	isESR(version) ? 'esr' : 'default';

/**
 * Download balenaOS image for the specified `deviceType`.
 * `OSVersion` may be one of:
 *  - exact version number,
 *  - valid semver range,
 *  - `latest` (exludes invalidated & pre-releases),
 *  - `menu`/'menu-esr' (will show the interactive menu )
 * If not provided, OSVersion will be set to `default`
 *
 * @param deviceType
 * @param outputPath
 * @param OSVersion
 */
export async function downloadOSImage(
	deviceType: string,
	outputPath: string,
	OSVersion?: string,
) {
	console.info(`Getting device operating system for ${deviceType}`);

	if (!OSVersion) {
		console.warn('OS version not specified: using latest released version');
		OSVersion = 'latest';
	}
	OSVersion = await resolveOSVersion(deviceType, OSVersion);

	// Override the default zlib flush value as we've seen cases of
	// incomplete files being identified as successful downloads when using Z_SYNC_FLUSH.
	// Using Z_NO_FLUSH results in a Z_BUF_ERROR instead of a corrupt image file.
	// https://github.com/nodejs/node/blob/master/doc/api/zlib.md#zlib-constants
	// Hopefully this is a temporary workaround until we can resolve
	// some ongoing issues with the os download stream.
	process.env.ZLIB_FLUSH = 'Z_NO_FLUSH';

	const { getStream } = await import('./image-manager');
	const stream = await getStream(deviceType, OSVersion);

	const displayVersion = await new Promise((resolve, reject) => {
		stream.on('error', reject);
		stream.on('balena-image-manager:resolved-version', resolve);
	});

	const visuals = getVisuals();
	const bar = new visuals.Progress(
		`Downloading balenaOS version ${displayVersion}`,
	);
	const spinner = new visuals.Spinner(
		`Downloading balenaOS version ${displayVersion} (size unknown)`,
	);

	stream.on('progress', (state: any) => {
		if (state != null) {
			return bar.update(state);
		}
		spinner.start();
	});

	stream.on('end', () => {
		spinner.stop();
	});

	// We completely rely on the `mime` custom property
	// to make this decision.
	// The actual stream should be checked instead.
	let output;
	if (stream.mime === 'application/zip') {
		const unzip = await import('node-unzip-2');
		output = unzip.Extract({ path: outputPath });
	} else {
		const fs = await import('fs');
		output = fs.createWriteStream(outputPath);
	}

	const { pipeline } = await import('node:stream/promises');
	await pipeline(stream, output);

	console.info(
		`balenaOS image version ${displayVersion} downloaded successfully`,
	);

	return outputPath;
}

async function resolveOSVersion(
	deviceType: string,
	version: string,
): Promise<string> {
	if (['menu', 'menu-esr'].includes(version)) {
		return await selectOSVersionFromMenu(
			deviceType,
			version === 'menu-esr',
			false,
		);
	}
	const { normalizeOsVersion } = await import('./normalization');
	version = normalizeOsVersion(version);
	return version;
}

async function selectOSVersionFromMenu(
	deviceType: string,
	esr: boolean,
	includeDraft: boolean,
): Promise<string> {
	const vs = await getOsVersions(deviceType, esr, includeDraft);

	const choices = vs.map((v) => ({
		value: v.raw_version,
		name: formatOsVersion(v),
	}));

	return getCliForm().ask({
		message: 'Select the OS version:',
		type: 'list',
		choices,
		default: vs[0]?.raw_version,
	});
}

/**
 * Return the output of sdk.models.os.getAvailableOsVersions(), resolving
 * device type aliases and filtering with regard to ESR versions.
 */
export async function getOsVersions(
	deviceType: string,
	esr: boolean,
	includeDraft: boolean,
): Promise<SDK.OsVersion[]> {
	const sdk = getBalenaSdk();
	let slug = deviceType;
	let versions: SDK.OsVersion[] = await sdk.models.os.getAvailableOsVersions(
		slug,
		undefined,
		{ includeDraft },
	);
	// if slug is an alias, fetch the real slug
	if (!versions.length) {
		// unalias device type slug
		slug = (await sdk.models.deviceType.get(slug, { $select: 'slug' })).slug;
		if (slug !== deviceType) {
			versions = await sdk.models.os.getAvailableOsVersions(slug, undefined, {
				includeDraft,
			});
		}
	}
	versions = versions.filter(
		(v: SDK.OsVersion) => v.osType === (esr ? 'esr' : 'default'),
	);
	if (!versions.length) {
		const vType = esr ? 'ESR versions' : 'versions';
		throw new ExpectedError(
			`Error: No balenaOS ${vType} found for device type '${deviceType}'.`,
		);
	}
	return versions;
}

export function formatOsVersion(osVersion: SDK.OsVersion): string {
	return osVersion.line
		? `v${osVersion.raw_version} (${osVersion.line})`
		: `v${osVersion.raw_version}`;
}
