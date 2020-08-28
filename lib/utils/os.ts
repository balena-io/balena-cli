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

/**
 * This module is a copy-and-paste (with minor amendments) from:
 * https://github.com/balena-io/balena-ui/blob/v2.497.9/src/services/os.ts
 */

import * as semver from 'balena-semver';
import { flatten } from 'lodash';
import memoizee = require('memoizee');
import type * as BalenaSdk from 'balena-sdk';

import { getBalenaSdk } from './lazy';

export interface OsVersion {
	id: number;
	rawVersion: string;
	strippedVersion: string;
	basedOnVersion?: string;
	osType: string;
	line?: OsLines;
	variant?: string;

	formattedVersion: string;
	isRecommended?: boolean;
}

export interface DeviceTypeOsVersions {
	[deviceTypeSlug: string]: OsVersion[];
}

const RELEASE_POLICY_TAG_NAME = 'release-policy';
const ESR_NEXT_TAG_NAME = 'esr-next';
const ESR_CURRENT_TAG_NAME = 'esr-current';
const ESR_SUNSET_TAG_NAME = 'esr-sunset';
const VARIANT_TAG_NAME = 'variant';
const VERSION_TAG_NAME = 'version';
const BASED_ON_VERSION_TAG_NAME = 'meta-balena-base';

export enum OsTypes {
	DEFAULT = 'default',
	ESR = 'esr',
}

export const esrLineColors: Record<NonNullable<OsLines>, number> = {
	next: 1,
	current: 0,
	sunset: 12,
	outdated: 5,
};

const getExpandedProp = <T, K extends keyof T>(
	obj: BalenaSdk.OptionalNavigationResource<T>,
	key: K,
) => (Array.isArray(obj) && obj[0] && obj[0][key]) || undefined;

const getTagValue = (tags: BalenaSdk.ResourceTagBase[], tagKey: string) => {
	return tags.find((tag) => tag.tag_key === tagKey)?.value;
};

const sortVersions = (a: OsVersion, b: OsVersion) => {
	return semver.rcompare(a.rawVersion, b.rawVersion);
};

const normalizeVariant = (variant: string) => {
	switch (variant) {
		case 'production':
			return 'prod';
		case 'development':
			return 'dev';
		default:
			return variant;
	}
};

const filterVersionsForAppType = (
	versions: OsVersion[],
	appType?: BalenaSdk.ApplicationType,
) => {
	if (!appType) {
		return versions;
	}

	// If app type is passed, remove any os versions that don't apply to that app type.
	const osVersionRange = appType.needs__os_version_range;
	return versions.filter((version) => {
		if (osVersionRange) {
			const ver = version.strippedVersion;
			return semver.satisfies(ver, osVersionRange);
		}

		return true;
	});
};

const getOsAppTags = (applicationTag: BalenaSdk.ApplicationTag[]) => {
	return {
		osType:
			getTagValue(applicationTag, RELEASE_POLICY_TAG_NAME) ?? OsTypes.DEFAULT,
		nextLineVersionRange: getTagValue(applicationTag, ESR_NEXT_TAG_NAME) ?? '',
		currentLineVersionRange:
			getTagValue(applicationTag, ESR_CURRENT_TAG_NAME) ?? '',
		sunsetLineVersionRange:
			getTagValue(applicationTag, ESR_SUNSET_TAG_NAME) ?? '',
	};
};

type HostAppTagSet = ReturnType<typeof getOsAppTags>;
export type OsLines = ReturnType<typeof getOsVersionReleaseLine>;

const getOsVersionReleaseLine = (version: string, appTags: HostAppTagSet) => {
	// All patches belong to the same line.
	if (semver.satisfies(version, `^${appTags.nextLineVersionRange}`)) {
		return 'next';
	}
	if (semver.satisfies(version, `^${appTags.currentLineVersionRange}`)) {
		return 'current';
	}
	if (semver.satisfies(version, `^${appTags.sunsetLineVersionRange}`)) {
		return 'sunset';
	}

	if (appTags.osType?.toLowerCase() === OsTypes.ESR) {
		return 'outdated';
	}
};

const getOsVersionsFromReleases = (
	releases: BalenaSdk.Release[],
	appTags: HostAppTagSet,
): OsVersion[] => {
	return releases.map((release) => {
		// The variant in the tags is a full noun, such as `production` and `development`.
		const variant =
			getTagValue(release.release_tag!, VARIANT_TAG_NAME) ?? 'production';
		const normalizedVariant = normalizeVariant(variant);
		const version = getTagValue(release.release_tag!, VERSION_TAG_NAME) ?? '';
		const basedOnVersion =
			getTagValue(release.release_tag!, BASED_ON_VERSION_TAG_NAME) ?? version;
		const line = getOsVersionReleaseLine(version, appTags);
		const lineFormat = line ? ` (${line})` : '';

		// TODO: Don't append the variant and sent it as a separate parameter when requesting a download when we don't use /device-types anymore and the API and image maker can handle it. Also rename `rawVersion` -> `versionWithVariant` if it is needed (it might not be needed anymore).
		// The version coming from relese tags doesn't contain the variant, so we append it here
		return {
			id: release.id,
			osType: appTags.osType,
			line,
			strippedVersion: version,
			rawVersion: `${version}.${normalizedVariant}`,
			basedOnVersion,
			variant: normalizedVariant,
			formattedVersion: `v${version}${lineFormat}`,
		};
	});
};

// This mutates the passed object.
const transformVersionSets = (
	deviceTypeOsVersions: DeviceTypeOsVersions,
	appType?: BalenaSdk.ApplicationType,
) => {
	Object.keys(deviceTypeOsVersions).forEach((deviceType) => {
		deviceTypeOsVersions[deviceType] = filterVersionsForAppType(
			deviceTypeOsVersions[deviceType],
			appType,
		);
		deviceTypeOsVersions[deviceType].sort(sortVersions);
		const recommendedPerOsType: Dictionary<boolean> = {};

		// Note: the recommended version settings might come from the server in the future, for now we just set it to the latest version for each os type.
		deviceTypeOsVersions[deviceType].forEach((version) => {
			if (!recommendedPerOsType[version.osType]) {
				if (
					version.variant !== 'dev' &&
					!semver.prerelease(version.rawVersion)
				) {
					const additionalFormat = version.line
						? ` (${version.line}, recommended)`
						: ' (recommended)';

					version.isRecommended = true;
					version.formattedVersion = `v${version.strippedVersion}${additionalFormat}`;
					recommendedPerOsType[version.osType] = true;
				}
			}
		});
	});

	return deviceTypeOsVersions;
};

const getSupportedHostApps = (applicationId: number, deviceTypes: string[]) => {
	return getBalenaSdk().pine.get<BalenaSdk.ApplicationHostedOnApplication>({
		resource: 'application__can_use__application_as_host',
		options: {
			$select: ['can_use__application_as_host'],
			$filter: {
				application: applicationId,
				can_use__application_as_host: {
					is_for__device_type: {
						$any: {
							$alias: 'dt',
							$expr: {
								dt: {
									slug: { $in: deviceTypes },
								},
							},
						},
					},
				},
			},
			$expand: {
				can_use__application_as_host: {
					$select: ['id', 'app_name'],
					$expand: {
						application_tag: {
							$select: ['id', 'tag_key', 'value'],
						},
						is_for__device_type: {
							$select: ['slug'],
						},
					},
				},
			},
		},
	});
};

const getOsVersions = (deviceTypes: string[]) => {
	return getBalenaSdk().pine.get<BalenaSdk.Application>({
		resource: 'application',
		options: {
			$filter: {
				is_host: true,
				is_for__device_type: {
					$any: {
						$alias: 'dt',
						$expr: {
							dt: {
								slug: { $in: deviceTypes },
							},
						},
					},
				},
			},
			$select: ['id', 'app_name'],
			$expand: {
				application_tag: {
					$select: ['id', 'tag_key', 'value'],
				},
				is_for__device_type: {
					$select: ['slug'],
				},
				owns__release: {
					$select: ['id'],
					$expand: {
						release_tag: {
							$select: ['id', 'tag_key', 'value'],
						},
					},
					$filter: {
						is_invalidated: false,
					},
				},
			},
		},
	});
};

const transformHostApps = (apps: BalenaSdk.Application[]) => {
	const res: DeviceTypeOsVersions = apps.reduce(
		(deviceTypeOsVersions: DeviceTypeOsVersions, hostApp) => {
			if (!hostApp) {
				return deviceTypeOsVersions;
			}

			const hostAppDeviceType = getExpandedProp(
				hostApp.is_for__device_type,
				'slug',
			)!;
			if (!hostAppDeviceType) {
				return deviceTypeOsVersions;
			}

			let osVersions = deviceTypeOsVersions[hostAppDeviceType];
			if (!osVersions) {
				osVersions = [];
			}

			const appTags = getOsAppTags(hostApp.application_tag ?? []);
			osVersions = osVersions.concat(
				getOsVersionsFromReleases(hostApp.owns__release ?? [], appTags),
			);
			deviceTypeOsVersions[hostAppDeviceType] = osVersions;

			return deviceTypeOsVersions;
		},
		{},
	);

	return res;
};

const memoizedGetSupportedHostApps = memoizee(getSupportedHostApps, {
	maxAge: 10 * 60 * 1000,
	primitive: true,
	promise: true,
});
const memoizedGetOsVersions = memoizee(getOsVersions, {
	maxAge: 10 * 60 * 1000,
	primitive: true,
	promise: true,
});

export const getAllOsVersions = (
	deviceTypes: string[],
	appType?: BalenaSdk.ApplicationType,
): Promise<DeviceTypeOsVersions> => {
	const sortedDeviceTypes = deviceTypes.sort();
	return memoizedGetOsVersions(sortedDeviceTypes)
		.then(transformHostApps)
		.then((deviceTypeOsVersions) =>
			transformVersionSets(deviceTypeOsVersions, appType),
		)
		.then((deviceTypeOsVersions) => {
			Object.values(deviceTypeOsVersions).forEach((versions) => {
				versions.sort(sortVersions);
			});
			return deviceTypeOsVersions;
		});
};

export const getSupportedOsVersions = (
	applicationId: number,
	deviceTypes: string[],
	appType?: BalenaSdk.ApplicationType,
) => {
	return Promise.all([
		getAllOsVersions(deviceTypes, appType),
		getSupportedOsTypes(applicationId, deviceTypes),
	]).then(([osVersions, osTypes]) => {
		return filterOsVersionsForOsTypes(osVersions, osTypes);
	});
};

const filterOsVersionsForOsTypes = (
	osVersions: DeviceTypeOsVersions,
	osTypes: string[],
) => {
	return Object.keys(osVersions).reduce(
		(filteredOsVersions: DeviceTypeOsVersions, deviceTypeKey) => {
			filteredOsVersions[deviceTypeKey] = osVersions[
				deviceTypeKey
			].filter((osVersion) => osTypes.includes(osVersion.osType));
			return filteredOsVersions;
		},
		{},
	);
};

export const getSupportedOsTypes = (
	applicationId: number,
	deviceTypes: string[],
): Promise<string[]> => {
	return memoizedGetSupportedHostApps(applicationId, deviceTypes)
		.then((resp) => {
			return resp.reduce((osTypes: Set<string>, hostApps) => {
				const hostApp = (hostApps.can_use__application_as_host as BalenaSdk.Application[])[0];
				if (!hostApp) {
					return osTypes;
				}

				const appTags = getOsAppTags(hostApp.application_tag ?? []);
				if (appTags.osType) {
					osTypes.add(appTags.osType);
				}

				return osTypes;
			}, new Set<string>());
		})
		.then((osTypesSet) => Array.from(osTypesSet))
		.catch((e: Error) => {
			// reportException('Unable to retrieve OS version types', e);
			console.error('Unable to retrieve OS version types');
			throw e;
		});
};

export const hasEsrVersions = (deviceTypes: string[]) => {
	return getAllOsVersions(deviceTypes).then((versions) => {
		return Object.keys(versions).reduce(
			(deviceTypeHasEsr: Dictionary<boolean>, deviceTypeSlug) => {
				deviceTypeHasEsr[deviceTypeSlug] = versions[deviceTypeSlug].some(
					(version) => version.osType === OsTypes.ESR,
				);
				return deviceTypeHasEsr;
			},
			{},
		);
	});
};

export const getOsTypeName = (osTypeSlug: string) => {
	switch (osTypeSlug) {
		case OsTypes.DEFAULT:
			return 'balenaOS';
		case OsTypes.ESR:
			return 'balenaOS ESR';
		default:
			return 'unknown';
	}
};

export const getFlattenedOsVersions = (
	supportedOsVersions: DeviceTypeOsVersions,
) => {
	return flatten(Object.values(supportedOsVersions)).sort(sortVersions);
};

// Use this function to add the variant to the end of a
// selected osVersion 2.44.0+rev10 => 2.44.0+rev10.dev
export const addOsVersionVariant = (osVersion: string, osVariant?: string) =>
	osVariant ? `${osVersion}.${osVariant}` : `${osVersion}.prod`;
