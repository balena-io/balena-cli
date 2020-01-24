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

// tslint:disable-next-line:no-var-requires
require('../config-tests'); // required for side effects

import { expect } from 'chai';
import { fs } from 'mz';
import * as path from 'path';
import { URL } from 'url';

import { BalenaAPIMock } from '../balena-api-mock';
import { BuilderMock, builderResponsePath } from '../builder-mock';
import {
	cleanOutput,
	inspectTarStream,
	runCommand,
	TarStreamFiles,
} from '../helpers';

const repoPath = path.normalize(path.join(__dirname, '..', '..'));
const projectsPath = path.join(repoPath, 'tests', 'test-data', 'projects');

const expectedResponses = {
	'build-POST-v3.json': [
		'[Info] Starting build for testApp, user gh_user',
		'[Info] Dashboard link: https://dashboard.balena-cloud.com/apps/1301645/devices',
		'[Info] Building on arm01',
		'[Info] Pulling previous images for caching purposes...',
		'[Success] Successfully pulled cache images',
		'[main] Step 1/4 : FROM busybox',
		'[main] ---> 76aea0766768',
		'[main] Step 2/4 : COPY ./src/start.sh /start.sh',
		'[main] ---> b563ad6a0801',
		'[main] Step 3/4 : RUN chmod a+x /start.sh',
		'[main] ---> Running in 10d4ddc40bfc',
		'[main] Removing intermediate container 10d4ddc40bfc',
		'[main] ---> 82e98871a32c',
		'[main] Step 4/4 : CMD ["/start.sh"]',
		'[main] ---> Running in 0682894e13eb',
		'[main] Removing intermediate container 0682894e13eb',
		'[main] ---> 889ccb6afc7c',
		'[main] Successfully built 889ccb6afc7c',
		'[Info] Uploading images',
		'[Success] Successfully uploaded images',
		'[Info] Built on arm01',
		'[Success] Release successfully created!',
		'[Info] Release: 05a24b5b034c9f95f25d4d74f0593bea (id: 1220245)',
		'[Info] ┌─────────┬────────────┬────────────┐',
		'[Info] │ Service │ Image Size │ Build Time │',
		'[Info] ├─────────┼────────────┼────────────┤',
		'[Info] │ main │ 1.32 MB │ 11 seconds │',
		'[Info] └─────────┴────────────┴────────────┘',
		'[Info] Build finished in 20 seconds',
	],
};

function tweakOutput(out: string[]): string[] {
	return cleanOutput(out).map(line =>
		line.replace(/\s{2,}/g, ' ').replace(/in \d+? seconds/, 'in 20 seconds'),
	);
}

describe('balena push', function() {
	let api: BalenaAPIMock;
	let builder: BuilderMock;

	const commonQueryParams = [
		['owner', 'bob'],
		['app', 'testApp'],
		['dockerfilePath', ''],
		['emulated', 'false'],
		['nocache', 'false'],
		['headless', 'false'],
	];

	this.beforeEach(() => {
		api = new BalenaAPIMock();
		builder = new BuilderMock();
		api.expectGetWhoAmI({ optional: true, persist: true });
		api.expectGetMixpanel({ optional: true });
		api.expectGetMyApplication();
	});

	this.afterEach(() => {
		// Check all expected api calls have been made and clean up.
		api.done();
		builder.done();
	});

	it('should create the expected tar stream (single container)', async () => {
		const projectPath = path.join(projectsPath, 'no-docker-compose', 'basic');
		const expectedFiles: TarStreamFiles = {
			'src/start.sh': { fileSize: 89, type: 'file' },
			Dockerfile: { fileSize: 85, type: 'file' },
			'Dockerfile-alt': { fileSize: 30, type: 'file' },
		};
		const responseFilename = 'build-POST-v3.json';
		const responseBody = await fs.readFile(
			path.join(builderResponsePath, responseFilename),
			'utf8',
		);

		builder.expectPostBuild({
			responseCode: 200,
			responseBody,
			checkURI: async (uri: string) => {
				const url = new URL(uri, 'http://test.net/');
				const queryParams = Array.from(url.searchParams.entries());
				expect(queryParams).to.have.deep.members(commonQueryParams);
			},
			checkBuildRequestBody: (buildRequestBody: string | Buffer) =>
				inspectTarStream(buildRequestBody, expectedFiles, projectPath, expect),
		});

		const { out, err } = await runCommand(
			`push testApp --source ${projectPath}`,
		);

		expect(err).to.have.members([]);
		expect(tweakOutput(out)).to.include.members(
			expectedResponses[responseFilename],
		);
	});

	it('should create the expected tar stream (alternative Dockerfile)', async () => {
		const projectPath = path.join(projectsPath, 'no-docker-compose', 'basic');
		const expectedFiles: TarStreamFiles = {
			'src/start.sh': { fileSize: 89, type: 'file' },
			Dockerfile: { fileSize: 85, type: 'file' },
			'Dockerfile-alt': { fileSize: 30, type: 'file' },
		};
		const responseFilename = 'build-POST-v3.json';
		const responseBody = await fs.readFile(
			path.join(builderResponsePath, responseFilename),
			'utf8',
		);

		builder.expectPostBuild({
			responseCode: 200,
			responseBody,
			checkURI: async (uri: string) => {
				const url = new URL(uri, 'http://test.net/');
				const queryParams = Array.from(url.searchParams.entries());
				expect(queryParams).to.have.deep.members(
					commonQueryParams.map(i =>
						i[0] === 'dockerfilePath'
							? ['dockerfilePath', 'Dockerfile-alt']
							: i,
					),
				);
			},
			checkBuildRequestBody: (buildRequestBody: string | Buffer) =>
				inspectTarStream(buildRequestBody, expectedFiles, projectPath, expect),
		});

		const { out, err } = await runCommand(
			`push testApp --source ${projectPath} --dockerfile Dockerfile-alt`,
		);

		expect(err).to.have.members([]);
		expect(tweakOutput(out)).to.include.members(
			expectedResponses[responseFilename],
		);
	});
});
