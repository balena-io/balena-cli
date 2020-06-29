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
import { promises as fs } from 'fs';
import * as path from 'path';
import * as sinon from 'sinon';

import { BalenaAPIMock } from '../balena-api-mock';
import { expectStreamNoCRLF, testDockerBuildStream } from '../docker-build';
import { DockerMock, dockerResponsePath } from '../docker-mock';
import { cleanOutput, runCommand, switchSentry } from '../helpers';
import {
	ExpectedTarStreamFiles,
	ExpectedTarStreamFilesByService,
} from '../projects';

const repoPath = path.normalize(path.join(__dirname, '..', '..'));
const projectsPath = path.join(repoPath, 'tests', 'test-data', 'projects');

const commonResponseLines = {
	'build-POST.json': [
		'[Info] Building for armv7hf/raspberrypi3',
		'[Info] Docker Desktop detected (daemon architecture: "x86_64")',
		'[Info] Docker itself will determine and enable architecture emulation if required,',
		'[Info] without balena-cli intervention and regardless of the --emulated option.',
		// '[Build] main Step 1/4 : FROM busybox',
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

const commonComposeQueryParams = [
	['t', '${tag}'],
	[
		'buildargs',
		'{"MY_VAR_1":"This is a variable","MY_VAR_2":"Also a variable"}',
	],
	['labels', ''],
];

const hr =
	'----------------------------------------------------------------------';

describe('balena deploy', function () {
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
		api.expectPostRelease();
		api.expectGetRelease();
		api.expectGetUser();
		api.expectGetService({ serviceName: 'main' });
		api.expectPostService404();
		api.expectGetAuth();
		api.expectPostImage();
		api.expectPostImageIsPartOfRelease();

		docker.expectGetImages();
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
		const expectedFiles: ExpectedTarStreamFiles = {
			'src/.dockerignore': { fileSize: 16, type: 'file' },
			'src/start.sh': { fileSize: 89, type: 'file' },
			'src/windows-crlf.sh': {
				fileSize: isWindows ? 68 : 70,
				testStream: isWindows ? expectStreamNoCRLF : undefined,
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
			...[
				`[Warn] ${hr}`,
				'[Warn] The following .dockerignore file(s) will not be used:',
				`[Warn] * ${path.join(projectPath, 'src', '.dockerignore')}`,
				'[Warn] By default, only one .dockerignore file at the source folder (project root)',
				'[Warn] is used. Microservices (multicontainer) applications may use a separate',
				'[Warn] .dockerignore file for each service with the --multi-dockerignore (-m) option.',
				'[Warn] See "balena help deploy" for more details.',
				`[Warn] ${hr}`,
			],
		];
		if (isWindows) {
			const fname = path.join(projectPath, 'src', 'windows-crlf.sh');
			expectedResponseLines.push(
				`[Info] Converting line endings CRLF -> LF for file: ${fname}`,
			);
		}

		api.expectPatchImage({});
		api.expectPatchRelease({});
		api.expectPostImageLabel();

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
		let sentryStatus: boolean | undefined;
		const projectPath = path.join(projectsPath, 'no-docker-compose', 'basic');
		const expectedFiles: ExpectedTarStreamFiles = {
			'src/.dockerignore': { fileSize: 16, type: 'file' },
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
		// The SDK should produce an "unexpected" BalenaRequestError, which
		// causes the CLI to call process.exit() with process.exitCode = 1
		const expectedExitCode = 1;

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
		api.expectPostImageLabel();

		try {
			sentryStatus = await switchSentry(false);
			sinon.stub(process, 'exit');

			await testDockerBuildStream({
				commandLine: `deploy testApp --build --source ${projectPath} --noconvert-eol -G`,
				dockerMock: docker,
				expectedFilesByService: { main: expectedFiles },
				expectedQueryParamsByService: { main: commonQueryParams },
				expectedErrorLines,
				expectedExitCode,
				expectedResponseLines,
				projectPath,
				responseBody,
				responseCode: 200,
				services: ['main'],
			});
		} finally {
			await switchSentry(sentryStatus);
			// @ts-ignore
			process.exit.restore();
		}
	});

	it('should create the expected tar stream (docker-compose, --multi-dockerignore)', async () => {
		const projectPath = path.join(projectsPath, 'docker-compose', 'basic');
		const service1Dockerfile = (
			await fs.readFile(
				path.join(projectPath, 'service1', 'Dockerfile.template'),
				'utf8',
			)
		).replace('%%BALENA_MACHINE_NAME%%', 'raspberrypi3');

		console.error(
			`Dockerfile.template (replaced) length=${service1Dockerfile.length}`,
		);
		console.error(service1Dockerfile);

		const expectedFilesByService: ExpectedTarStreamFilesByService = {
			service1: {
				Dockerfile: {
					contents: service1Dockerfile,
					fileSize: service1Dockerfile.length,
					type: 'file',
				},
				'Dockerfile.template': { fileSize: 144, type: 'file' },
				'file1.sh': { fileSize: 12, type: 'file' },
				'test-ignore.txt': { fileSize: 12, type: 'file' },
			},
			service2: {
				'.dockerignore': { fileSize: 12, type: 'file' },
				'Dockerfile-alt': { fileSize: 40, type: 'file' },
				'file2-crlf.sh': {
					fileSize: isWindows ? 12 : 14,
					testStream: isWindows ? expectStreamNoCRLF : undefined,
					type: 'file',
				},
			},
		};
		const responseFilename = 'build-POST.json';
		const responseBody = await fs.readFile(
			path.join(dockerResponsePath, responseFilename),
			'utf8',
		);
		const expectedQueryParamsByService = {
			service1: [
				['t', '${tag}'],
				[
					'buildargs',
					'{"MY_VAR_1":"This is a variable","MY_VAR_2":"Also a variable","SERVICE1_VAR":"This is a service specific variable"}',
				],
				['labels', ''],
			],
			service2: [...commonComposeQueryParams, ['dockerfile', 'Dockerfile-alt']],
		};
		const expectedResponseLines: string[] = [
			...commonResponseLines[responseFilename],
			...[
				'[Build] service1 Step 1/4 : FROM busybox',
				'[Build] service2 Step 1/4 : FROM busybox',
			],
			...[
				`[Info] ${hr}`,
				'[Info] The --multi-dockerignore option is being used, and a .dockerignore file was',
				'[Info] found at the project source (root) directory. Note that this file will not',
				'[Info] be used to filter service subdirectories. See "balena help deploy".',
				`[Info] ${hr}`,
			],
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

		// docker.expectGetImages();
		api.expectPatchImage({});
		api.expectPatchRelease({});

		await testDockerBuildStream({
			commandLine: `deploy testApp --build --source ${projectPath} --multi-dockerignore`,
			dockerMock: docker,
			expectedFilesByService,
			expectedQueryParamsByService,
			expectedResponseLines,
			projectPath,
			responseBody,
			responseCode: 200,
			services: ['service1', 'service2'],
		});
	});
});

describe('balena deploy: project validation', function () {
	let api: BalenaAPIMock;

	this.beforeEach(() => {
		api = new BalenaAPIMock();
		api.expectGetWhoAmI({ optional: true, persist: true });
		api.expectGetMixpanel({ optional: true });
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
		expect(cleanOutput(err, true)).to.include.members(expectedErrorLines);
		expect(out).to.be.empty;
	});
});
