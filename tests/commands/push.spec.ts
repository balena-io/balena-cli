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

import { BalenaAPIMock } from '../balena-api-mock';
import { BuilderMock, builderResponsePath } from '../builder-mock';
import {
	ExpectedTarStreamFiles,
	expectStreamNoCRLF,
	testPushBuildStream,
} from '../docker-build';
import { cleanOutput, runCommand } from '../helpers';

const repoPath = path.normalize(path.join(__dirname, '..', '..'));
const projectsPath = path.join(repoPath, 'tests', 'test-data', 'projects');

const commonResponseLines = {
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
	],
};

const commonQueryParams = [
	['owner', 'bob'],
	['app', 'testApp'],
	['dockerfilePath', ''],
	['emulated', 'false'],
	['nocache', 'false'],
	['headless', 'false'],
];

describe('balena push', function() {
	let api: BalenaAPIMock;
	let builder: BuilderMock;
	const isWindows = process.platform === 'win32';

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
		const expectedFiles: ExpectedTarStreamFiles = {
			'src/start.sh': { fileSize: 89, type: 'file' },
			'src/windows-crlf.sh': { fileSize: 70, type: 'file' },
			Dockerfile: { fileSize: 88, type: 'file' },
			'Dockerfile-alt': { fileSize: 30, type: 'file' },
		};
		const responseFilename = 'build-POST-v3.json';
		const responseBody = await fs.readFile(
			path.join(builderResponsePath, responseFilename),
			'utf8',
		);
		const expectedResponseLines = [...commonResponseLines[responseFilename]];
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

		await testPushBuildStream({
			builderMock: builder,
			commandLine: `push testApp --source ${projectPath}`,
			expectedFiles,
			expectedQueryParams: commonQueryParams,
			expectedResponseLines,
			projectPath,
			responseBody,
			responseCode: 200,
		});
	});

	it('should create the expected tar stream (alternative Dockerfile)', async () => {
		const projectPath = path.join(projectsPath, 'no-docker-compose', 'basic');
		const expectedFiles: ExpectedTarStreamFiles = {
			'src/start.sh': { fileSize: 89, type: 'file' },
			'src/windows-crlf.sh': { fileSize: 70, type: 'file' },
			Dockerfile: { fileSize: 88, type: 'file' },
			'Dockerfile-alt': { fileSize: 30, type: 'file' },
		};
		const responseFilename = 'build-POST-v3.json';
		const responseBody = await fs.readFile(
			path.join(builderResponsePath, responseFilename),
			'utf8',
		);
		const expectedQueryParams = commonQueryParams.map(i =>
			i[0] === 'dockerfilePath' ? ['dockerfilePath', 'Dockerfile-alt'] : i,
		);

		await testPushBuildStream({
			builderMock: builder,
			commandLine: `push testApp --source ${projectPath} --dockerfile Dockerfile-alt`,
			expectedFiles,
			expectedQueryParams,
			expectedResponseLines: commonResponseLines[responseFilename],
			projectPath,
			responseBody,
			responseCode: 200,
		});
	});

	it('should create the expected tar stream (single container, --convert-eol)', async () => {
		const projectPath = path.join(projectsPath, 'no-docker-compose', 'basic');
		const expectedFiles: ExpectedTarStreamFiles = {
			'src/start.sh': { fileSize: 89, type: 'file' },
			'src/windows-crlf.sh': {
				fileSize: isWindows ? 68 : 70,
				type: 'file',
				testStream: isWindows ? expectStreamNoCRLF : undefined,
			},
			Dockerfile: { fileSize: 88, type: 'file' },
			'Dockerfile-alt': { fileSize: 30, type: 'file' },
		};
		const responseFilename = 'build-POST-v3.json';
		const responseBody = await fs.readFile(
			path.join(builderResponsePath, responseFilename),
			'utf8',
		);
		const expectedResponseLines = [...commonResponseLines[responseFilename]];
		if (isWindows) {
			expectedResponseLines.push(
				`[Info] Converting line endings CRLF -> LF for file: ${path.join(
					projectPath,
					'src',
					'windows-crlf.sh',
				)}`,
			);
		}

		await testPushBuildStream({
			builderMock: builder,
			commandLine: `push testApp --source ${projectPath} --convert-eol`,
			expectedFiles,
			expectedQueryParams: commonQueryParams,
			expectedResponseLines,
			projectPath,
			responseBody,
			responseCode: 200,
		});
	});

	it('should create the expected tar stream (docker-compose)', async () => {
		const projectPath = path.join(projectsPath, 'docker-compose', 'basic');
		const expectedFiles: ExpectedTarStreamFiles = {
			'docker-compose.yml': { fileSize: 245, type: 'file' },
			'service1/Dockerfile.template': { fileSize: 144, type: 'file' },
			'service1/file1.sh': { fileSize: 12, type: 'file' },
			'service2/Dockerfile-alt': { fileSize: 40, type: 'file' },
			'service2/file2-crlf.sh': {
				fileSize: isWindows ? 12 : 14,
				testStream: isWindows ? expectStreamNoCRLF : undefined,
				type: 'file',
			},
		};
		const responseFilename = 'build-POST-v3.json';
		const responseBody = await fs.readFile(
			path.join(builderResponsePath, responseFilename),
			'utf8',
		);
		const expectedResponseLines: string[] = [
			...commonResponseLines[responseFilename],
		];
		if (isWindows) {
			expectedResponseLines.push(
				`[Info] Converting line endings CRLF -> LF for file: ${path.join(
					projectPath,
					'service2',
					'file2-crlf.sh',
				)}`,
			);
		}

		await testPushBuildStream({
			builderMock: builder,
			commandLine: `push testApp --source ${projectPath} --convert-eol`,
			expectedFiles,
			expectedQueryParams: commonQueryParams,
			expectedResponseLines,
			projectPath,
			responseBody,
			responseCode: 200,
		});
	});
});

describe('balena push: project validation', function() {
	it('should raise ExpectedError if the project folder is not a directory', async () => {
		const projectPath = path.join(
			projectsPath,
			'docker-compose',
			'basic',
			'docker-compose.yml',
		);
		const expectedErrorLines = [
			`Could not access source folder: "${projectPath}"`,
		];

		const { out, err } = await runCommand(
			`push testApp --source ${projectPath}`,
		);
		expect(
			cleanOutput(err).map(line => line.replace(/\s{2,}/g, ' ')),
		).to.include.members(expectedErrorLines);
		expect(out).to.be.empty;
	});

	it('should raise ExpectedError if a Dockerfile cannot be found', async () => {
		const projectPath = path.join(
			projectsPath,
			'docker-compose',
			'basic',
			'service2',
		);
		const expectedErrorLines = [
			'Error: no "Dockerfile[.*]", "docker-compose.yml" or "package.json" file',
			`found in source folder "${projectPath}"`,
		];

		const { out, err } = await runCommand(
			`push testApp --source ${projectPath}`,
		);
		expect(
			cleanOutput(err).map(line => line.replace(/\s{2,}/g, ' ')),
		).to.include.members(expectedErrorLines);
		expect(out).to.be.empty;
	});

	it('should log a warning if a docker-compose.yml exists in a parent folder', async () => {
		const projectPath = path.join(
			projectsPath,
			'docker-compose',
			'basic',
			'service1',
		);
		const expectedErrorLines = [
			'The --nolive flag is only valid when pushing to a local mode device',
		];
		const expectedOutputLines = [
			'[Warn] "docker-compose.y[a]ml" file found in parent directory: please check',
			"[Warn] that the correct folder was specified. (Suppress with '--noparent-check'.)",
		];

		const { out, err } = await runCommand(
			`push testApp --source ${projectPath} --nolive`,
		);
		expect(
			cleanOutput(err).map(line => line.replace(/\s{2,}/g, ' ')),
		).to.include.members(expectedErrorLines);
		expect(
			cleanOutput(out).map(line => line.replace(/\s{2,}/g, ' ')),
		).to.include.members(expectedOutputLines);
	});

	it('should suppress a parent folder check with --noparent-check', async () => {
		const projectPath = path.join(
			projectsPath,
			'docker-compose',
			'basic',
			'service1',
		);
		const expectedErrorLines = [
			'The --nolive flag is only valid when pushing to a local mode device',
		];

		const { out, err } = await runCommand(
			`push testApp --source ${projectPath} --nolive --noparent-check`,
		);
		expect(
			cleanOutput(err).map(line => line.replace(/\s{2,}/g, ' ')),
		).to.include.members(expectedErrorLines);
		expect(out).to.be.empty;
	});
});
