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

import { fs } from 'mz';
import * as path from 'path';

import { BalenaAPIMock } from '../balena-api-mock';
import { ExpectedTarStreamFiles, testDockerBuildStream } from '../docker-build';
import { DockerMock, dockerResponsePath } from '../docker-mock';

const repoPath = path.normalize(path.join(__dirname, '..', '..'));
const projectsPath = path.join(repoPath, 'tests', 'test-data', 'projects');

const commonResponseLines = {
	'build-POST.json': [
		'[Info] Building for armv7hf/raspberrypi3',
		'[Info] Docker Desktop detected (daemon architecture: "x86_64")',
		'[Info] Docker itself will determine and enable architecture emulation if required,',
		'[Info] without balena-cli intervention and regardless of the --emulated option.',
		'[Build] main Image size: 1.14 MB',
		'[Info] Creating release...',
		'[Info] Pushing images to registry...',
		'[Info] Saving release...',
		'[Success] Deploy succeeded!',
		'[Success] Release: 09f7c3e1fdec609be818002299edfc2a',
	],
};

const commonQueryParams = [
	['t', '${tag}'],
	['buildargs', '{}'],
	['labels', ''],
];

describe('balena deploy', function() {
	let api: BalenaAPIMock;
	let docker: DockerMock;
	const isWindows = process.platform === 'win32';

	this.beforeEach(() => {
		api = new BalenaAPIMock();
		docker = new DockerMock();
		api.expectGetWhoAmI({ optional: true, persist: true });
		api.expectGetMixpanel({ optional: true });
		api.expectGetDeviceTypes();
		api.expectGetApplication();
		api.expectPatchRelease();
		api.expectPostRelease();
		api.expectGetRelease();
		api.expectGetUser();
		api.expectGetService({ serviceName: 'main' });
		api.expectPostService404();
		api.expectGetAuth();
		api.expectPostImage();
		api.expectPostImageIsPartOfRelease();
		api.expectPostImageLabel();
		api.expectPatchImage();

		docker.expectGetPing();
		docker.expectGetInfo();
		docker.expectGetVersion({ persist: true });
		docker.expectPostImagesTag();
		docker.expectPostImagesPush();
		docker.expectDeleteImages();
	});

	this.afterEach(() => {
		// Check all expected api calls have been made and clean up.
		api.done();
		docker.done();
	});

	it('should create the expected --build tar stream (single container)', async () => {
		const projectPath = path.join(projectsPath, 'no-docker-compose', 'basic');
		const expectedFiles: ExpectedTarStreamFiles = {
			'src/start.sh': { fileSize: 89, type: 'file' },
			'src/windows-crlf.sh': { fileSize: 70, type: 'file' },
			Dockerfile: { fileSize: 88, type: 'file' },
			'Dockerfile-alt': { fileSize: 30, type: 'file' },
		};
		const responseFilename = 'build-POST.json';
		const responseBody = await fs.readFile(
			path.join(dockerResponsePath, responseFilename),
			'utf8',
		);
		const expectedResponseLines = [
			...commonResponseLines[responseFilename],
			`[Info] No "docker-compose.yml" file found at "${projectPath}"`,
			`[Info] Creating default composition with source: "${projectPath}"`,
		];
		if (isWindows) {
			expectedResponseLines.push(
				`[Warn] CRLF (Windows) line endings detected in file: ${path.join(
					projectPath,
					'src',
					'windows-crlf.sh',
				)}`,
				'[Warn] Windows-format line endings were detected in some files. Consider using the `--convert-eol` option.',
			);
		}

		await testDockerBuildStream({
			commandLine: `deploy testApp --build --source ${projectPath}`,
			dockerMock: docker,
			expectedFilesByService: { main: expectedFiles },
			expectedQueryParamsByService: { main: commonQueryParams },
			expectedResponseLines,
			projectPath,
			responseBody,
			responseCode: 200,
			services: ['main'],
		});
	});
});
