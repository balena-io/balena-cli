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
import * as sinon from 'sinon';

import { isV12 } from '../../build/utils/version';
import { BalenaAPIMock } from '../balena-api-mock';
import { expectStreamNoCRLF, testDockerBuildStream } from '../docker-build';
import { DockerMock, dockerResponsePath } from '../docker-mock';
import { cleanOutput, runCommand, switchSentry } from '../helpers';
import { ExpectedTarStreamFiles } from '../projects';

const repoPath = path.normalize(path.join(__dirname, '..', '..'));
const projectsPath = path.join(repoPath, 'tests', 'test-data', 'projects');

const commonResponseLines = {
	'build-POST.json': [
		'[Info] Building for armv7hf/raspberrypi3',
		'[Info] Docker Desktop detected (daemon architecture: "x86_64")',
		'[Info] Docker itself will determine and enable architecture emulation if required,',
		'[Info] without balena-cli intervention and regardless of the --emulated option.',
		isV12()
			? '[Build] main Step 1/4 : FROM busybox'
			: '[Build] main Image size: 1.14 MB',
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
	let sentryStatus: boolean | undefined;
	const isWindows = process.platform === 'win32';

	this.beforeAll(async () => {
		sentryStatus = await switchSentry(false);
		sinon.stub(process, 'exit');
	});

	this.afterAll(async () => {
		await switchSentry(sentryStatus);
		// @ts-ignore
		process.exit.restore();
	});

	this.beforeEach(() => {
		api = new BalenaAPIMock();
		docker = new DockerMock();
		api.expectGetWhoAmI({ optional: true, persist: true });
		api.expectGetMixpanel({ optional: true });
		api.expectGetDeviceTypes();
		api.expectGetApplication();
		api.expectPostRelease();
		api.expectGetRelease();
		api.expectGetUser();
		api.expectGetService({ serviceName: 'main' });
		api.expectPostService404();
		api.expectGetAuth();
		api.expectPostImage();
		api.expectPostImageIsPartOfRelease();
		api.expectPostImageLabel();

		docker.expectGetPing();
		docker.expectGetInfo({});
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
		const isV12W = isWindows && isV12();
		const expectedFiles: ExpectedTarStreamFiles = {
			'src/start.sh': { fileSize: 89, type: 'file' },
			'src/windows-crlf.sh': {
				fileSize: isV12W ? 68 : 70,
				testStream: isV12W ? expectStreamNoCRLF : undefined,
				type: 'file',
			},
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
			const fname = path.join(projectPath, 'src', 'windows-crlf.sh');
			if (isV12()) {
				expectedResponseLines.push(
					`[Info] Converting line endings CRLF -> LF for file: ${fname}`,
				);
			} else {
				expectedResponseLines.push(
					`[Warn] CRLF (Windows) line endings detected in file: ${fname}`,
					'[Warn] Windows-format line endings were detected in some files. Consider using the `--convert-eol` option.',
				);
			}
		}

		api.expectPatchImage({});
		api.expectPatchRelease({});

		await testDockerBuildStream({
			commandLine: `deploy testApp --build --source ${projectPath} -G`,
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

	it('should update a release with status="failed" on error (single container)', async () => {
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
		const expectedResponseLines = ['[Error] Deploy failed'];
		const errMsg = 'Patch Image Error';
		const expectedErrorLines = [errMsg];

		// Mock this patch HTTP request to return status code 500, in which case
		// the release status should be saved as "failed" rather than "success"
		api.expectPatchImage({
			replyBody: errMsg,
			statusCode: 500,
			inspectRequest: (_uri, requestBody) => {
				const imageBody = requestBody as Partial<
					import('balena-release/build/models').ImageModel
				>;
				expect(imageBody.status).to.equal('success');
			},
		});
		// Check that the CLI patches the release with status="failed"
		api.expectPatchRelease({
			inspectRequest: (_uri, requestBody) => {
				const releaseBody = requestBody as Partial<
					import('balena-release/build/models').ReleaseModel
				>;
				expect(releaseBody.status).to.equal('failed');
			},
		});

		await testDockerBuildStream({
			commandLine: `deploy testApp --build --source ${projectPath} --noconvert-eol -G`,
			dockerMock: docker,
			expectedFilesByService: { main: expectedFiles },
			expectedQueryParamsByService: { main: commonQueryParams },
			expectedErrorLines,
			expectedResponseLines,
			projectPath,
			responseBody,
			responseCode: 200,
			services: ['main'],
		});
		// The SDK should produce an "unexpected" BalenaRequestError, which
		// causes the CLI to call process.exit() with process.exitCode = 1
		// @ts-ignore
		sinon.assert.calledWith(process.exit);
		expect(process.exitCode).to.equal(1);
	});
});

describe('balena deploy: project validation', function() {
	let api: BalenaAPIMock;
	this.beforeEach(() => {
		api = new BalenaAPIMock();
		api.expectGetWhoAmI({ optional: true, persist: true });
	});

	this.afterEach(() => {
		// Check all expected api calls have been made and clean up.
		api.done();
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
			`deploy testApp --source ${projectPath}`,
		);
		expect(
			cleanOutput(err).map(line => line.replace(/\s{2,}/g, ' ')),
		).to.include.members(expectedErrorLines);
		expect(out).to.be.empty;
	});
});
