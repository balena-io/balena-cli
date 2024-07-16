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

import { expect } from 'chai';
import _ from 'lodash';
import mock from 'mock-require';
import { promises as fs } from 'fs';
import * as path from 'path';

import { stripIndent } from '../../lib/utils/lazy';
import { BalenaAPIMock } from '../nock/balena-api-mock';
import { expectStreamNoCRLF, testDockerBuildStream } from '../docker-build';
import { DockerMock, dockerResponsePath } from '../nock/docker-mock';
import { cleanOutput, runCommand } from '../helpers';
import type {
	ExpectedTarStreamFiles,
	ExpectedTarStreamFilesByService,
} from '../projects';
import {
	getDockerignoreWarn1,
	getDockerignoreWarn2,
	getDockerignoreWarn3,
} from '../projects';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const repoPath = path.normalize(path.join(import.meta.dirname, '..', '..'));
const projectsPath = path.join(repoPath, 'tests', 'test-data', 'projects');

const commonResponseLines: { [key: string]: string[] } = {
	'build-POST.json': [
		'[Info] Building for amd64/nuc',
		'[Info] Docker Desktop detected (daemon architecture: "x86_64")',
		'[Info] Docker itself will determine and enable architecture emulation if required,',
		'[Info] without balena-cli intervention and regardless of the --emulated option.',
		'[Success] Build succeeded!',
	],
};

const commonQueryParams = {
	t: '${tag}',
	buildargs: {},
	labels: '',
};

const commonQueryParamsIntel = {
	...commonQueryParams,
	platform: 'linux/amd64',
};

const commonQueryParamsArmV6 = {
	...commonQueryParams,
	platform: 'linux/arm/v6',
};

const commonComposeQueryParams = {
	t: '${tag}',
	buildargs: {
		MY_VAR_1: 'This is a variable',
		MY_VAR_2: 'Also a variable',
	},
	labels: '',
};

const commonComposeQueryParamsIntel = {
	...commonComposeQueryParams,
	platform: 'linux/amd64',
};

// "itSS" means "it() Skip Standalone"
const itSS = process.env.BALENA_CLI_TEST_TYPE === 'standalone' ? it.skip : it;

describe('balena build', function () {
	let api: BalenaAPIMock;
	let docker: DockerMock;
	const isWindows = process.platform === 'win32';

	this.beforeEach(() => {
		api = new BalenaAPIMock();
		docker = new DockerMock();
		api.expectGetWhoAmI({ optional: true, persist: true });
		api.expectGetMixpanel({ optional: true });
		docker.expectGetPing();
		docker.expectGetVersion({ persist: true });
	});

	this.afterEach(() => {
		// Check all expected api calls have been made and clean up.
		api.done();
		docker.done();
	});

	it('should create the expected tar stream (single container)', async () => {
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
			'[Build] main Step 1/4 : FROM busybox',
		];
		if (isWindows) {
			const fname = path.join(projectPath, 'src', 'windows-crlf.sh');
			expectedResponseLines.push(
				`[Info] Converting line endings CRLF -> LF for file: ${fname}`,
			);
		}
		docker.expectGetInfo({});
		docker.expectGetManifestBusybox();
		await testDockerBuildStream({
			commandLine: `build ${projectPath} --deviceType nuc --arch amd64`,
			dockerMock: docker,
			expectedFilesByService: { main: expectedFiles },
			expectedQueryParamsByService: {
				main: Object.entries(commonQueryParamsIntel),
			},
			expectedResponseLines,
			projectPath,
			responseBody,
			responseCode: 200,
			services: ['main'],
		});
	});

	it('should create the expected tar stream (--buildArg and --cache-from)', async () => {
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
		const expectedQueryParams = {
			...commonQueryParamsIntel,
			buildargs: '{"BARG1":"b1","barg2":"B2"}',
			cachefrom: '["my/img1","my/img2"]',
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
			'[Build] main Step 1/4 : FROM busybox',
			...getDockerignoreWarn1(
				[path.join(projectPath, 'src', '.dockerignore')],
				'build',
			),
		];
		if (isWindows) {
			const fname = path.join(projectPath, 'src', 'windows-crlf.sh');
			expectedResponseLines.push(
				`[Info] Converting line endings CRLF -> LF for file: ${fname}`,
			);
		}
		docker.expectGetInfo({});
		docker.expectGetManifestBusybox();
		await testDockerBuildStream({
			commandLine: `build ${projectPath} --deviceType nuc --arch amd64 -B BARG1=b1 -B barg2=B2 --cache-from my/img1,my/img2`,
			dockerMock: docker,
			expectedFilesByService: { main: expectedFiles },
			expectedQueryParamsByService: {
				main: Object.entries(expectedQueryParams),
			},
			expectedResponseLines,
			projectPath,
			responseBody,
			responseCode: 200,
			services: ['main'],
		});
	});

	// Skip Standalone because we patch the source code with `mock-require` to avoid
	// downloading and installing QEMU
	itSS('should create the expected tar stream (--emulated)', async () => {
		const projectPath = path.join(projectsPath, 'no-docker-compose', 'basic');
		const transposedDockerfile =
			stripIndent`
			FROM busybox
			COPY [".balena/qemu-execve","/tmp/qemu-execve"]
			COPY ["./src","/usr/src/"]
			RUN ["/tmp/qemu-execve","-execve","/bin/sh","-c","chmod a+x /usr/src/*.sh"]
			CMD ["/usr/src/start.sh"]` + '\n';
		const expectedFiles: ExpectedTarStreamFiles = {
			'src/.dockerignore': { fileSize: 16, type: 'file' },
			'src/start.sh': { fileSize: 89, type: 'file' },
			'src/windows-crlf.sh': {
				fileSize: isWindows ? 68 : 70,
				testStream: isWindows ? expectStreamNoCRLF : undefined,
				type: 'file',
			},
			Dockerfile: {
				fileSize: transposedDockerfile.length,
				type: 'file',
				contents: transposedDockerfile,
			},
			'Dockerfile-alt': { fileSize: 30, type: 'file' },
		};
		const responseFilename = 'build-POST.json';
		const responseBody = await fs.readFile(
			path.join(dockerResponsePath, responseFilename),
			'utf8',
		);
		const expectedResponseLines = [
			`[Info] No "docker-compose.yml" file found at "${projectPath}"`,
			`[Info] Creating default composition with source: "${projectPath}"`,
			'[Info] Building for rpi/raspberry-pi',
			'[Info] Emulation is enabled',
			...getDockerignoreWarn1(
				[path.join(projectPath, 'src', '.dockerignore')],
				'build',
			),
			'[Build] main Step 1/4 : FROM busybox',
			'[Success] Build succeeded!',
		];
		if (isWindows) {
			const fname = path.join(projectPath, 'src', 'windows-crlf.sh');
			expectedResponseLines.push(
				`[Info] Converting line endings CRLF -> LF for file: ${fname}`,
			);
		}
		const arch = 'rpi';
		const deviceType = 'raspberry-pi';
		const fsModPath = 'fs';
		const fsMod = await import(fsModPath);
		const qemuModPath = '../../build/utils/qemu.js';
		const qemuMod = require(qemuModPath);
		const qemuBinPath = await qemuMod.getQemuPath(arch);
		try {
			// patch fs.access and fs.stat to pretend that a copy of the Qemu binary
			// already exists locally, thus preventing a download during tests
			mock(fsModPath, {
				...fsMod,
				promises: {
					...fsMod.promises,
					access: async (p: string) =>
						p === qemuBinPath ? undefined : fsMod.promises.access(p),
					stat: async (p: string) =>
						p === qemuBinPath ? { size: 1 } : fsMod.promises.stat(p),
				},
			});
			mock(qemuModPath, {
				...qemuMod,
				copyQemu: async () => '',
			});
			mock.reRequire('../../build/utils/qemu');
			docker.expectGetInfo({ OperatingSystem: 'balenaOS 2.44.0+rev1' });
			docker.expectGetManifestBusybox();
			await testDockerBuildStream({
				commandLine: `build ${projectPath} --emulated --deviceType ${deviceType} --arch ${arch}`,
				dockerMock: docker,
				expectedFilesByService: { main: expectedFiles },
				expectedQueryParamsByService: {
					main: Object.entries(commonQueryParamsArmV6),
				},
				expectedResponseLines,
				projectPath,
				responseBody,
				responseCode: 200,
				services: ['main'],
			});
		} finally {
			mock.stop(fsModPath);
			mock.stop(qemuModPath);
		}
	});

	it('should create the expected tar stream (single container, --noconvert-eol, --multi-dockerignore)', async () => {
		const projectPath = path.join(projectsPath, 'no-docker-compose', 'basic');
		const expectedFiles: ExpectedTarStreamFiles = {
			'src/.dockerignore': { fileSize: 16, type: 'file' },
			'src/start.sh': { fileSize: 89, type: 'file' },
			'src/windows-crlf.sh': {
				fileSize: 70,
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
			...getDockerignoreWarn2(
				[path.join(projectPath, 'src', '.dockerignore')],
				'build',
			),
			'[Build] main Step 1/4 : FROM busybox',
		];
		if (isWindows) {
			const fname = path.join(projectPath, 'src', 'windows-crlf.sh');
			expectedResponseLines.push(
				`[Warn] CRLF (Windows) line endings detected in file: ${fname}`,
				'[Warn] Windows-format line endings were detected in some files, but were not converted due to `--noconvert-eol` option.',
			);
		}
		docker.expectGetInfo({});
		docker.expectGetManifestBusybox();

		await testDockerBuildStream({
			commandLine: `build ${projectPath} --deviceType nuc --arch amd64 --noconvert-eol -m`,
			dockerMock: docker,
			expectedFilesByService: { main: expectedFiles },
			expectedQueryParamsByService: {
				main: Object.entries(commonQueryParamsIntel),
			},
			expectedResponseLines,
			projectPath,
			responseBody,
			responseCode: 200,
			services: ['main'],
		});
	});

	it('should create the expected tar stream (docker-compose)', async () => {
		const projectPath = path.join(projectsPath, 'docker-compose', 'basic');
		const service1Dockerfile = (
			await fs.readFile(
				path.join(projectPath, 'service1', 'Dockerfile.template'),
				'utf8',
			)
		).replace('%%BALENA_MACHINE_NAME%%', 'nuc');
		const expectedFilesByService: ExpectedTarStreamFilesByService = {
			service1: {
				Dockerfile: {
					contents: service1Dockerfile,
					fileSize: service1Dockerfile.length,
					type: 'file',
				},
				'Dockerfile.template': { fileSize: 144, type: 'file' },
				'file1.sh': { fileSize: 12, type: 'file' },
			},
			service2: {
				'Dockerfile-alt': { fileSize: 13, type: 'file' },
				'file2-crlf.sh': {
					fileSize: isWindows ? 12 : 14,
					testStream: isWindows ? expectStreamNoCRLF : undefined,
					type: 'file',
				},
				'src/file1.sh': { fileSize: 12, type: 'file' },
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
					buildargs: {
						COMPOSE_ARG: 'A',
						barg: 'b',
						SERVICE1_VAR: 'This is a service specific variable',
					},
					cachefrom: ['my/img1', 'my/img2'],
				}),
			),
			service2: Object.entries(
				_.merge({}, commonComposeQueryParamsIntel, {
					buildargs: {
						COMPOSE_ARG: 'A',
						barg: 'b',
					},
					cachefrom: ['my/img1', 'my/img2'],
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
			...getDockerignoreWarn1(
				[path.join(projectPath, 'service2', '.dockerignore')],
				'build',
			),
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
		docker.expectGetInfo({});
		docker.expectGetManifestNucAlpine();
		docker.expectGetManifestBusybox();
		await testDockerBuildStream({
			commandLine: `build ${projectPath} --deviceType nuc --arch amd64 -B COMPOSE_ARG=A -B barg=b --cache-from my/img1,my/img2`,
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

	it('should create the expected tar stream (docker-compose, --multi-dockerignore)', async () => {
		const projectPath = path.join(projectsPath, 'docker-compose', 'basic');
		const service1Dockerfile = (
			await fs.readFile(
				path.join(projectPath, 'service1', 'Dockerfile.template'),
				'utf8',
			)
		).replace('%%BALENA_MACHINE_NAME%%', 'nuc');
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
				_.merge({}, commonComposeQueryParamsIntel, {
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
			...getDockerignoreWarn3('build'),
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
		docker.expectGetInfo({});
		docker.expectGetManifestBusybox();
		docker.expectGetManifestNucAlpine();

		await testDockerBuildStream({
			commandLine: `build ${projectPath} --deviceType nuc --arch amd64 -m`,
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

	it('should create the expected tar stream (--projectName and --tag)', async () => {
		const projectPath = path.join(projectsPath, 'docker-compose', 'basic');
		const service1Dockerfile = (
			await fs.readFile(
				path.join(projectPath, 'service1', 'Dockerfile.template'),
				'utf8',
			)
		).replace('%%BALENA_MACHINE_NAME%%', 'nuc');
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
				_.merge({}, commonComposeQueryParamsIntel, {
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
			...getDockerignoreWarn3('build'),
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
		const projectName = 'spectest';
		const tag = 'myTag';
		docker.expectGetInfo({});
		docker.expectGetManifestBusybox();
		docker.expectGetManifestNucAlpine();

		await testDockerBuildStream({
			commandLine: `build ${projectPath} --deviceType nuc --arch amd64 -m --tag ${tag} --projectName ${projectName}`,
			dockerMock: docker,
			expectedFilesByService,
			expectedQueryParamsByService,
			expectedResponseLines,
			projectName,
			projectPath,
			responseBody,
			responseCode: 200,
			services: ['service1', 'service2'],
			tag,
		});
	});
});

describe('balena build: project validation', function () {
	let api: BalenaAPIMock;

	this.beforeEach(() => {
		api = new BalenaAPIMock();
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
			`build ${projectPath} -A amd64 -d nuc`,
		);
		expect(cleanOutput(err, true)).to.include.members(expectedErrorLines);
		expect(out).to.be.empty;
	});
});
