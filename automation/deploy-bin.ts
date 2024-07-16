/**
 * @license
 * Copyright 2019 Balena Ltd.
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

import _ from 'lodash';
import * as semver from 'semver';
import { Octokit as OctokitLib } from '@octokit/rest';
import OctoKitPluginThrottling from '@octokit/plugin-throttling';
import parse from 'parse-link-header';

const { GITHUB_TOKEN } = process.env;

/** Return a cached Octokit instance, creating a new one as needed. */
const getOctokit = _.once(function () {
	const Octokit = OctokitLib.plugin(OctoKitPluginThrottling.throttling);
	return new Octokit({
		auth: GITHUB_TOKEN,
		throttle: {
			onRateLimit: (retryAfter: number, options: any) => {
				console.warn(
					`Request quota exhausted for request ${options.method} ${options.url}`,
				);
				// retries 3 times
				if (options.request.retryCount < 3) {
					console.log(`Retrying after ${retryAfter} seconds!`);
					return true;
				}
			},
			onAbuseLimit: (_retryAfter: number, options: any) => {
				// does not retry, only logs a warning
				console.warn(
					`Abuse detected for request ${options.method} ${options.url}`,
				);
			},
		},
	});
});

/**
 * Extract pagination information (current page, total pages, ordinal number)
 * from the 'link' response header (example below), using the parse-link-header
 * npm package:
 * "link": "<https://api.github.com/repositories/187370853/releases?per_page=2&page=2>; rel=\"next\",
 *          <https://api.github.com/repositories/187370853/releases?per_page=2&page=3>; rel=\"last\""
 *
 * @param response Octokit response object (including response.headers.link)
 * @param perPageDefault Default per_page pagination value if missing in URL
 * @return Object where 'page' is the current page number (1-based),
 * 'pages' is the total number of pages, and 'ordinal' is the ordinal number
 * (3rd, 4th, 5th...) of the first item in the current page.
 */
function getPageNumbers(
	response: any,
	perPageDefault: number,
): { page: number; pages: number; ordinal: number } {
	const res = { page: 1, pages: 1, ordinal: 1 };
	if (!response.headers.link) {
		return res;
	}

	const parsed = parse(response.headers.link);
	if (parsed == null) {
		throw new Error(`Failed to parse link header: '${response.headers.link}'`);
	}
	let perPage = perPageDefault;
	if (parsed.next) {
		if (parsed.next.per_page) {
			perPage = parseInt(parsed.next.per_page, 10);
		}
		res.page = parseInt(parsed.next.page, 10) - 1;
		res.pages = parseInt(parsed.last.page, 10);
	} else {
		if (parsed.prev.per_page) {
			perPage = parseInt(parsed.prev.per_page, 10);
		}
		res.page = res.pages = parseInt(parsed.prev.page, 10) + 1;
	}
	res.ordinal = (res.page - 1) * perPage + 1;
	return res;
}

/**
 * Iterate over every GitHub release in the given owner/repo, check whether
 * its tag_name matches against the affectedVersions semver spec, and if so
 * replace its release description (body) with the given newDescription value.
 * @param owner GitHub repo owner, e.g. 'balena-io' or 'pdcastro'
 * @param repo GitHub repo, e.g. 'balena-cli'
 * @param affectedVersions Semver spec, e.g. '2.6.1 - 7.10.9 || 8.0.0'
 * @param newDescription New release description (body)
 * @param editID Short string present in newDescription, e.g. '[AA101]', that
 * can be searched to determine whether that release has already been updated.
 */
async function updateGitHubReleaseDescriptions(
	owner: string,
	repo: string,
	affectedVersions: string,
	newDescription: string,
	editID: string,
) {
	const perPage = 30;
	const octokit = getOctokit();
	const options = octokit.repos.listReleases.endpoint.merge({
		owner,
		repo,
		per_page: perPage,
	});
	let errCount = 0;
	type Release =
		import('@octokit/rest').RestEndpointMethodTypes['repos']['listReleases']['response']['data'][0];
	for await (const response of octokit.paginate.iterator<Release>(options)) {
		const {
			page: thisPage,
			pages: totalPages,
			ordinal,
		} = getPageNumbers(response, perPage);
		let i = 0;
		for (const cliRelease of response.data) {
			const prefix = `[#${ordinal + i++} pg ${thisPage}/${totalPages}]`;
			if (!cliRelease.id) {
				console.error(
					`${prefix} Error: missing release ID (errCount=${++errCount})`,
				);
				continue;
			}
			const skipMsg = `${prefix} skipping release "${cliRelease.tag_name}" (${cliRelease.id})`;
			if (cliRelease.draft === true) {
				console.info(`${skipMsg}: draft release`);
				continue;
			} else if (cliRelease.body && cliRelease.body.includes(editID)) {
				console.info(`${skipMsg}: already updated`);
				continue;
			} else if (!semver.satisfies(cliRelease.tag_name, affectedVersions)) {
				console.info(`${skipMsg}: outside version range`);
				continue;
			} else {
				const updatedRelease = {
					owner,
					repo,
					release_id: cliRelease.id,
					body: newDescription,
				};
				let oldBodyPreview = cliRelease.body;
				if (oldBodyPreview) {
					oldBodyPreview = oldBodyPreview.replace(/\s+/g, ' ').trim();
					if (oldBodyPreview.length > 12) {
						oldBodyPreview = oldBodyPreview.substring(0, 9) + '...';
					}
				}
				console.info(
					`${prefix} updating release "${cliRelease.tag_name}" (${cliRelease.id}) old body="${oldBodyPreview}"`,
				);
				try {
					await octokit.repos.updateRelease(updatedRelease);
				} catch (err) {
					console.error(
						`${skipMsg}: Error: ${err.message} (count=${++errCount})`,
					);
					continue;
				}
			}
		}
	}
}

/**
 * Add a warning description to CLI releases affected by a mixpanel tracking
 * security issue (#1359). This function can be executed "manually" with the
 * following command line:
 *
 * npx ts-node --type-check -P automation/tsconfig.json automation/run.ts fix1359
 */
export async function updateDescriptionOfReleasesAffectedByIssue1359() {
	// Run only on Linux/Node10, instead of all platform/Node combinations.
	// (It could have been any other platform, as long as it only runs once.)
	if (process.platform !== 'linux' || semver.major(process.version) !== 10) {
		return;
	}
	const owner = 'balena-io';
	const repo = 'balena-cli';
	const affectedVersions =
		'2.6.1 - 7.10.9 || 8.0.0 - 8.1.0 || 9.0.0 - 9.15.6 || 10.0.0 - 10.17.5 || 11.0.0 - 11.7.2';
	const editID = '[AA100]';
	let newDescription = `
		Please note: the "login" command in this release is affected by a
		security issue fixed in versions
		[7.10.10](https://github.com/balena-io/balena-cli/releases/tag/v7.10.10),
		[8.1.1](https://github.com/balena-io/balena-cli/releases/tag/v8.1.1),
		[9.15.7](https://github.com/balena-io/balena-cli/releases/tag/v9.15.7),
		[10.17.6](https://github.com/balena-io/balena-cli/releases/tag/v10.17.6),
		[11.7.3](https://github.com/balena-io/balena-cli/releases/tag/v11.7.3)
		and later. If you need to use this version, avoid passing your password,
		keys or tokens as command-line arguments. ${editID}`;
	// remove line breaks and collapse white space
	newDescription = newDescription.replace(/\s+/g, ' ').trim();
	await updateGitHubReleaseDescriptions(
		owner,
		repo,
		affectedVersions,
		newDescription,
		editID,
	);
}
