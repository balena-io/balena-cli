/**
 * @license
 * Copyright 2021 Balena Ltd.
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

import type { BalenaSettingsStorage } from 'balena-settings-storage';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

export interface ReleaseTimestampsByVersion {
	[version: string]: string; // e.g. { '12.0.0': '2021-06-16T12:54:52.000Z' }
	lastFetched: string; // ISO 8601 timestamp, e.g. '2021-06-27T16:46:10.000Z'
}

/**
 * Warn about and enforce the CLI deprecation policy stated in the README
 * file. In particular:
 *   The latest release of a major version will remain compatible with
 *   the backend services for at least one year from the date when the
 *   following major version is released. [...]
 *   Half way through to that period (6 months), old major versions of the
 *   balena CLI will start printing a deprecation warning message.
 *   At the end of that period, older major versions will abort with an error
 *   message unless the `--unsupported` flag is used.
 *
 * - Check for new balena-cli releases by querying the npm registry.
 * - Cache results for a number of days to improve performance.
 *
 * For this feature's specification and planning, see (restricted access):
 * https://jel.ly.fish/ed8d2395-9323-418c-bb67-d11d32a17d00
 */
export class DeprecationChecker {
	readonly majorVersionFetchIntervalDays = 7;
	readonly expiryDays = 365;
	readonly deprecationDays = Math.ceil(this.expiryDays / 2);
	readonly msInDay = 24 * 60 * 60 * 1000; // milliseconds in a day
	readonly debugPrefix = 'Deprecation check';
	readonly cacheFile = 'cachedReleaseTimestamps';
	readonly now = new Date().getTime();
	private initialized = false;
	storage: BalenaSettingsStorage;
	cachedTimestamps: ReleaseTimestampsByVersion;
	nextMajorVersion: string; // semver without the 'v' prefix

	constructor(protected currentVersion: string) {
		const semver = require('semver') as typeof import('semver');
		const major = semver.major(this.currentVersion, { loose: true });
		this.nextMajorVersion = `${major + 1}.0.0`;
	}

	public async init() {
		if (this.initialized) {
			return;
		}
		this.initialized = true;

		const settings = await import('balena-settings-client');
		const { getStorage } = await import('balena-settings-storage');
		const dataDirectory = settings.get<string>('dataDirectory');
		this.storage = getStorage({ dataDirectory });
		let stored: ReleaseTimestampsByVersion | undefined;
		try {
			stored = (await this.storage.get(
				this.cacheFile,
			)) as ReleaseTimestampsByVersion;
		} catch {
			// ignore
		}
		this.cachedTimestamps = {
			...stored,
			// '1970-01-01T00:00:00.000Z' is new Date(0).toISOString()
			lastFetched: stored?.lastFetched || '1970-01-01T00:00:00.000Z',
		};
	}

	/**
	 * Get NPM registry URL to retrieve the package.json file for a given version.
	 * @param version Semver without 'v' prefix, e.g. '12.0.0.'
	 */
	protected getNpmUrl(version: string) {
		return `https://registry.npmjs.org/balena-cli/${version}`;
	}

	/**
	 * Query the npm registry (HTTP request) for a given balena-cli version.
	 *
	 * @param version semver version without the 'v' prefix, e.g. '13.0.0'
	 * @returns `undefined` if the request status code is 404 (version not
	 *   published), otherwise a publishedAt date in ISO 8601 format, e.g.
	 *   '2021-06-27T16:46:10.000Z'.
	 */
	protected async fetchPublishedTimestampForVersion(
		version: string,
	): Promise<string | undefined> {
		const { default: got } = (await import('got')).default;
		const url = this.getNpmUrl(version);
		let response: import('got').Response<Dictionary<any>> | undefined;
		try {
			response = await got(url, {
				responseType: 'json',
				retry: 0,
				timeout: 4000,
			});
		} catch (e) {
			// 404 is expected if `version` hasn't been published yet
			if (e.response?.statusCode !== 404) {
				throw new Error(`Failed to query "${url}":\n${e}`);
			}
		}
		// response.body looks like a package.json file, plus possibly a
		// `versionist.publishedAt` field added by `github.com/product-os/versionist`
		const publishedAt: string | undefined =
			response?.body?.versionist?.publishedAt;
		if (!publishedAt && process.env.DEBUG) {
			console.error(`\
[debug] ${this.debugPrefix}: balena CLI next major version "${this.nextMajorVersion}" not released, \
or release date not available`);
		}
		return publishedAt; // ISO 8601, e.g. '2021-06-27T16:46:10.000Z'
	}

	/**
	 * Check if we already know (cached value) when the next major version
	 * was released. If we don't know, check how long ago the npm registry
	 * was last fetched, and fetch again if it has been longer than
	 * `majorVersionFetchIntervalDays`.
	 */
	public async checkForNewReleasesIfNeeded() {
		if (process.env.BALENARC_UNSUPPORTED) {
			return; // for the benefit of code testing
		}
		await this.init();
		if (this.cachedTimestamps[this.nextMajorVersion]) {
			// A cached value exists: no need to check the npm registry
			return;
		}
		const lastFetched = new Date(this.cachedTimestamps.lastFetched).getTime();
		const daysSinceLastFetch = (this.now - lastFetched) / this.msInDay;
		if (daysSinceLastFetch < this.majorVersionFetchIntervalDays) {
			if (process.env.DEBUG) {
				// toFixed(5) results in a precision of ~1 second
				const days = daysSinceLastFetch.toFixed(5);
				console.error(`\
[debug] ${this.debugPrefix}: ${days} days since last npm registry query for next major version release date.
[debug] Will not query the registry again until at least ${this.majorVersionFetchIntervalDays} days have passed.`);
			}
			return;
		}
		if (process.env.DEBUG) {
			console.error(`\
[debug] ${
				this.debugPrefix
			}: Cache miss for the balena CLI next major version release date.
[debug] Will query ${this.getNpmUrl(this.nextMajorVersion)}`);
		}
		try {
			const publishedAt = await this.fetchPublishedTimestampForVersion(
				this.nextMajorVersion,
			);
			if (publishedAt) {
				this.cachedTimestamps[this.nextMajorVersion] = publishedAt;
			}
		} catch (e) {
			if (process.env.DEBUG) {
				console.error(`[debug] ${this.debugPrefix}: ${e}`);
			}
		}
		// Refresh `lastFetched` regardless of whether or not the request to the npm
		// registry was successful. Will try again after `majorVersionFetchIntervalDays`.
		this.cachedTimestamps.lastFetched = new Date(this.now).toISOString();
		await this.storage.set(this.cacheFile, this.cachedTimestamps);
	}

	/**
	 * Use previously cached data (local cache only, fast execution) to check
	 * whether this version of the CLI is deprecated as per deprecation policy,
	 * in which case warn about it and conditionally throw an error.
	 */
	public async warnAndAbortIfDeprecated() {
		if (process.env.BALENARC_UNSUPPORTED) {
			return; // for the benefit of code testing
		}
		await this.init();
		const nextMajorDateStr = this.cachedTimestamps[this.nextMajorVersion];
		if (!nextMajorDateStr) {
			return;
		}
		const nextMajorDate = new Date(nextMajorDateStr).getTime();
		const daysElapsed = Math.trunc((this.now - nextMajorDate) / this.msInDay);
		if (daysElapsed > this.expiryDays) {
			const { ExpectedError } = await import('./errors.js');
			throw new ExpectedError(this.getExpiryMsg(daysElapsed));
		} else if (daysElapsed > this.deprecationDays && process.stderr.isTTY) {
			console.error(this.getDeprecationMsg(daysElapsed));
		}
	}

	/** Separate function for the benefit of code testing */
	getDeprecationMsg(daysElapsed: number) {
		const { warnify } =
			require('./utils/messages') as typeof import('./utils/messages.js');
		return warnify(`\
CLI version ${this.nextMajorVersion} was released ${daysElapsed} days ago: please upgrade.
This version of the balena CLI (${this.currentVersion}) will exit with an error
message after ${this.expiryDays} days from the release of version ${this.nextMajorVersion},
as per deprecation policy: https://git.io/JRHUW#deprecation-policy

The --unsupported flag may be used to bypass this deprecation check and
allow the CLI to keep working beyond the deprecation period.  However,
note that the balenaCloud or openBalena backends may be updated in a way
that is no longer compatible with this version.`);
	}

	/** Separate function the benefit of code testing */
	getExpiryMsg(daysElapsed: number) {
		return `
This version of the balena CLI (${this.currentVersion}) has expired: please upgrade.
${daysElapsed} days have passed since the release of CLI version ${this.nextMajorVersion}.
See deprecation policy at: https://git.io/JRHUW#deprecation-policy

The --unsupported flag may be used to bypass this deprecation check and
continue using this version of the CLI. However, note that the balenaCloud
or openBalena backends may be updated in a way that is no longer compatible
with this CLI version.`;
	}
}
