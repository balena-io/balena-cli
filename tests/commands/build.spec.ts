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
import mock = require('mock-require');
import { promises as fs } from 'fs';
import * as path from 'path';

import { stripIndent } from '../../lib/utils/lazy';
import { BalenaAPIMock } from '../balena-api-mock';
import { expectStreamNoCRLF, testDockerBuildStream } from '../docker-build';
import { DockerMock, dockerResponsePath } from '../docker-mock';
import { cleanOutput, runCommand } from '../helpers';
import {
	ExpectedTarStreamFiles,
	ExpectedTarStreamFilesByService,
} from '../projects';

const repoPath = path.normalize(path.join(__dirname, '..', '..'));
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
		docker.expectGetVersion();
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
			if (isWindows) {
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
		docker.expectGetInfo({});
		await testDockerBuildStream({
			commandLine: `build ${projectPath} --deviceType nuc --arch amd64 -g`,
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
			...[
				`[Warn] ${hr}`,
				'[Warn] The following .dockerignore file(s) will not be used:',
				`[Warn] * ${path.join(projectPath, 'src', '.dockerignore')}`,
				'[Warn] By default, only one .dockerignore file at the source folder (project root)',
				'[Warn] is used. Microservices (multicontainer) applications may use a separate',
				'[Warn] .dockerignore file for each service with the --multi-dockerignore (-m) option.',
				'[Warn] See "balena help build" for more details.',
				`[Warn] ${hr}`,
			],
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
		const qemuModPath = '../../build/utils/qemu';
		const qemuMod = require(qemuModPath);
		const qemuBinPath = await qemuMod.getQemuPath(arch);
		try {
			mock(fsModPath, {
				...fsMod,
				promises: {
					...fsMod.promises,
					access: async (p: string) =>
						p === qemuBinPath ? undefined : fsMod.promises.access(p),
				},
			});
			mock(qemuModPath, {
				...qemuMod,
				copyQemu: async () => '',
			});
			mock.reRequire('../../build/utils/qemu');
			docker.expectGetInfo({ OperatingSystem: 'balenaOS 2.44.0+rev1' });
			await testDockerBuildStream({
				commandLine: `build ${projectPath} --emulated --deviceType ${deviceType} --arch ${arch} --nogitignore`,
				dockerMock: docker,
				expectedFilesByService: { main: expectedFiles },
				expectedQueryParamsByService: { main: commonQueryParams },
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

	it('should create the expected tar stream (single container, --[no]convert-eol, --multi-dockerignore)', async () => {
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
			...[
				`[Warn] ${hr}`,
				'[Warn] The following .dockerignore file(s) will not be used:',
				`[Warn] * ${path.join(projectPath, 'src', '.dockerignore')}`,
				'[Warn] When --multi-dockerignore (-m) is used, only .dockerignore files at the root of',
				"[Warn] each service's build context (in a microservices/multicontainer application),",
				'[Warn] plus a .dockerignore file at the overall project root, are used.',
				'[Warn] See "balena help build" for more details.',
				`[Warn] ${hr}`,
			],
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
		await testDockerBuildStream({
			commandLine: `build ${projectPath} --deviceType nuc --arch amd64 --noconvert-eol -m`,
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
				'.dockerignore': { fileSize: 12, type: 'file' },
				'Dockerfile-alt': { fileSize: 40, type: 'file' },
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
				`[Warn] ${hr}`,
				'[Warn] The following .dockerignore file(s) will not be used:',
				`[Warn] * ${path.join(projectPath, 'service2', '.dockerignore')}`,
				'[Warn] By default, only one .dockerignore file at the source folder (project root)',
				'[Warn] is used. Microservices (multicontainer) applications may use a separate',
				'[Warn] .dockerignore file for each service with the --multi-dockerignore (-m) option.',
				'[Warn] See "balena help build" for more details.',
				`[Warn] ${hr}`,
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
		docker.expectGetInfo({});
		await testDockerBuildStream({
			commandLine: `build ${projectPath} --deviceType nuc --arch amd64 --convert-eol -G`,
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
				'[Info] be used to filter service subdirectories. See "balena help build".',
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
		docker.expectGetInfo({});
		await testDockerBuildStream({
			commandLine: `build ${projectPath} --deviceType nuc --arch amd64 --convert-eol -m`,
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

describe('balena build: project validation', function () {
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
