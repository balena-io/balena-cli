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
import * as Bluebird from 'bluebird';
import * as _ from 'lodash';
import * as publishRelease from 'publish-release';

import { finalReleaseAssets, version } from './build-bin';

const { GITHUB_TOKEN } = process.env;

/**
 * Create or update a release in GitHub's releases page, uploading the
 * installer files (standalone zip + native oclif installers).
 */
export async function createGitHubRelease() {
	console.log(`Publishing release ${version} to GitHub`);
	const ghRelease = await Bluebird.fromCallback(
		publishRelease.bind(null, {
			token: GITHUB_TOKEN || '',
			owner: 'balena-io',
			repo: 'balena-cli',
			tag: version,
			name: `balena-CLI ${version}`,
			reuseRelease: true,
			assets: finalReleaseAssets[process.platform],
		}),
	);
	console.log(`Release ${version} successful: ${ghRelease.html_url}`);
}

/**
 * Top-level function to create a CLI release in GitHub's releases page:
 * call zipStandaloneInstaller(), rename the files as we'd like them to
 * display on the releases page, and call createGitHubRelease() to upload
 * the files.
 */
export async function release() {
	try {
		await createGitHubRelease();
	} catch (err) {
		console.error('Release failed');
		console.error(err);
		process.exit(1);
	}
}
