/**
 * @license
 * Copyright 2020-2021 Balena Ltd.
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

import { intVar } from '@balena/env-parsing';
import type { Request as ReleaseRequest } from '@balena/compose/dist/release';
import { expect } from 'chai';
import { promises as fs } from 'fs';
import _ from 'lodash';
import type * as nock from 'nock';
import * as path from 'path';
import * as sinon from 'sinon';

import { BalenaAPIMock } from '../nock/balena-api-mock';
import { expectStreamNoCRLF, testDockerBuildStream } from '../docker-build';
import { DockerMock, dockerResponsePath } from '../nock/docker-mock';
import { cleanOutput, runCommand, switchSentry } from '../helpers';
import type {
	ExpectedTarStreamFiles,
	ExpectedTarStreamFilesByService,
} from '../projects';
import { getDockerignoreWarn1, getDockerignoreWarn3 } from '../projects';

const repoPath = path.normalize(path.join(import.meta.dirname, '..', '..'));
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
	['platform', 'linux/arm/v7'],
	['t', '${tag}'],
	['buildargs', '{}'],
	['labels', ''],
];

const commonComposeQueryParams = {
	t: '${tag}',
	buildargs: {
		MY_VAR_1: 'This is a variable',
		MY_VAR_2: 'Also a variable',
	},
	labels: '',
};

const commonComposeQueryParamsArmV7 = {
	...commonComposeQueryParams,
	platform: 'linux/arm/v7',
};

describe('balena deploy', function () {
	let api: BalenaAPIMock;
	let docker: DockerMock;
	const isWindows = process.platform === 'win32';

	this.beforeEach(() => {
		api = new BalenaAPIMock();
		docker = new DockerMock();
		api.expectGetWhoAmI({ optional: true, persist: true });
		api.expectGetMixpanel({ optional: true });
		api.expectGetApplication({ expandArchitecture: true });
		api.expectGetRelease();
		api.expectGetUser();
		api.expectGetService({ serviceName: 'main' });
		api.expectPostService409();
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
			...getDockerignoreWarn1(
				[path.join(projectPath, 'src', '.dockerignore')],
				'deploy',
			),
		];
		if (isWindows) {
			const fname = path.join(projectPath, 'src', 'windows-crlf.sh');
			expectedResponseLines.push(
				`[Info] Converting line endings CRLF -> LF for file: ${fname}`,
			);
		}

		api.expectPostRelease({});
		api.expectPatchImage({});
		api.expectPatchRelease({});
		api.expectPostImageLabel();
		docker.expectGetManifestBusybox();

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

	it('should handle the contract and final status for a final (non-draft) release', async () => {
		const projectPath = path.join(
			projectsPath,
			'no-docker-compose',
			'with-contract',
		);
		const expectedFiles: ExpectedTarStreamFiles = {
			'src/start.sh': { fileSize: 30, type: 'file' },
			Dockerfile: { fileSize: 88, type: 'file' },
			'balena.yml': { fileSize: 55, type: 'file' },
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

		api.expectPostRelease({
			inspectRequest: (_uri: string, requestBody: nock.Body) => {
				const body = requestBody.valueOf() as Partial<ReleaseRequest>;
				expect(body.contract).to.be.equal(
					'{"name":"testContract","type":"sw.application","version":"1.5.2"}',
				);
				expect(body.is_final).to.be.true;
			},
		});
		api.expectPatchImage({});
		api.expectPatchRelease({});
		api.expectPostImageLabel();
		docker.expectGetManifestBusybox();

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

	it('should handle the contract and final status for a draft release', async () => {
		const projectPath = path.join(
			projectsPath,
			'no-docker-compose',
			'with-contract',
		);
		const expectedFiles: ExpectedTarStreamFiles = {
			'src/start.sh': { fileSize: 30, type: 'file' },
			Dockerfile: { fileSize: 88, type: 'file' },
			'balena.yml': { fileSize: 55, type: 'file' },
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

		api.expectPostRelease({
			inspectRequest: (_uri: string, requestBody: nock.Body) => {
				const body = requestBody.valueOf() as Partial<ReleaseRequest>;
				expect(body.contract).to.be.equal(
					'{"name":"testContract","type":"sw.application","version":"1.5.2"}',
				);
				expect(body.semver).to.be.equal('1.5.2');
				expect(body.is_final).to.be.false;
			},
		});
		api.expectPatchImage({});
		api.expectPatchRelease({});
		api.expectPostImageLabel();
		docker.expectGetManifestBusybox();

		await testDockerBuildStream({
			commandLine: `deploy testApp --build --draft --source ${projectPath}`,
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
		const expectedErrorLines = [`Request error: ${errMsg}`];
		// The SDK should produce an "unexpected" BalenaRequestError, which
		// causes the CLI to call process.exit() with process.exitCode = 1
		const expectedExitCode = 1;

		api.expectPostRelease({});
		docker.expectGetManifestBusybox();

		let failedImagePatchRequests = 0;
		// Mock this patch HTTP request to return status code 500, in which case
		// the release status should be saved as "failed" rather than "success"
		const maxRequestRetries = intVar('BALENARCTEST_API_RETRY_MAX_ATTEMPTS');
		expect(
			maxRequestRetries,
			'BALENARCTEST_API_RETRY_MAX_ATTEMPTS must be >= 2 for this test',
		).to.be.greaterThanOrEqual(2);
		api.expectPatchImage({
			replyBody: errMsg,
			statusCode: 500,
			// b/c failed requests are retried
			times: maxRequestRetries,
			inspectRequest: (_uri, requestBody) => {
				const imageBody = requestBody as Partial<
					import('@balena/compose/dist/release/models').ImageModel
				>;
				expect(imageBody.status).to.equal('success');
				failedImagePatchRequests++;
			},
		});
		// Check that the CLI patches the release with status="failed"
		api.expectPatchRelease({
			inspectRequest: (_uri, requestBody) => {
				const releaseBody = requestBody as Partial<
					import('@balena/compose/dist/release/models').ReleaseModel
				>;
				expect(releaseBody.status).to.equal('failed');
			},
		});
		api.expectPostImageLabel();

		try {
			sentryStatus = await switchSentry(false);
			sinon.stub(process, 'exit');

			await testDockerBuildStream({
				commandLine: `deploy testApp --build --source ${projectPath} --noconvert-eol`,
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
			expect(failedImagePatchRequests).to.equal(maxRequestRetries);
		} finally {
			await switchSentry(sentryStatus);
			// @ts-expect-error claims restore does not exist
			process.exit.restore();
		}
	});

	it('should create the expected --build tar stream after retrying failing OData requests (single container)', async () => {
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
			...getDockerignoreWarn1(
				[path.join(projectPath, 'src', '.dockerignore')],
				'deploy',
			),
		];
		if (isWindows) {
			const fname = path.join(projectPath, 'src', 'windows-crlf.sh');
			expectedResponseLines.push(
				`[Info] Converting line endings CRLF -> LF for file: ${fname}`,
			);
		}

		api.expectPostRelease({});
		docker.expectGetManifestBusybox();

		const maxRequestRetries = intVar('BALENARCTEST_API_RETRY_MAX_ATTEMPTS');
		expect(
			maxRequestRetries,
			'BALENARCTEST_API_RETRY_MAX_ATTEMPTS must be >= 2 for this test',
		).to.be.greaterThanOrEqual(2);
		let failedImagePatchRequests = 0;
		let succesfullImagePatchRequests = 0;
		api
			.optPatch(/^\/v6\/image($|[(?])/, { times: maxRequestRetries })
			.reply((_uri, requestBody) => {
				const imageBody = requestBody as Partial<
					import('@balena/compose/dist/release/models').ImageModel
				>;
				expect(imageBody.status).to.equal('success');
				if (failedImagePatchRequests < maxRequestRetries - 1) {
					failedImagePatchRequests++;
					return [500, 'Patch Image Error'];
				}
				succesfullImagePatchRequests++;
				return [200, 'OK'];
			});
		api.expectPatchRelease({});
		api.expectPostImageLabel();

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
		expect(failedImagePatchRequests).to.equal(maxRequestRetries - 1);
		expect(succesfullImagePatchRequests).to.equal(1);
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
				'Dockerfile-alt': { fileSize: 13, type: 'file' },
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
			service1: Object.entries(
				_.merge({}, commonComposeQueryParams, {
					buildargs: { SERVICE1_VAR: 'This is a service specific variable' },
				}),
			),
			service2: Object.entries(
				_.merge({}, commonComposeQueryParamsArmV7, {
					buildargs: {
						COMPOSE_ARG: 'an argument defined in the docker-compose.yml file',
					},
					dockerfile: 'Dockerfile-alt',
				}),
			),
		};
		const expectedResponseLines: string[] = [
			...commonResponseLines[responseFilename],
			...[
				'[Build] service1 Step 1/4 : FROM busybox',
				'[Build] service2 Step 1/4 : FROM busybox',
			],
			...getDockerignoreWarn3('deploy'),
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

		api.expectPostRelease({});
		api.expectPatchImage({});
		api.expectPatchRelease({});
		docker.expectGetManifestRpi3Alpine();
		docker.expectGetManifestBusybox();

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
