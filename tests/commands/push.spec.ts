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
import { promises as fs } from 'fs';
import * as path from 'path';

import { MockHttpServer } from '../mockserver';
import { expectStreamNoCRLF, testPushBuildStream } from '../docker-build';
import { cleanOutput, runCommand } from '../helpers';
import type { ExpectedTarStreamFiles } from '../projects';
import {
	addRegSecretsEntries,
	exists,
	getDockerignoreWarn1,
	getDockerignoreWarn2,
	getDockerignoreWarn3,
	setupDockerignoreTestData,
} from '../projects';

const repoPath = path.normalize(path.join(__dirname, '..', '..'));
const projectsPath = path.join(repoPath, 'tests', 'test-data', 'projects');
const builderResponsePath = path.normalize(
	path.join(__dirname, '..', 'test-data', 'builder-response'),
);

const itNoWin = process.platform === 'win32' ? it.skip : it;

const commonResponseLines = {
	'build-POST-v3.json': [
		'[Info] Starting build for testApp, user gh_user',
		'[Info] Dashboard link: https://dashboard.balena-cloud.com/fleets/1301645',
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

// What the builder receives in place of the project's docker-compose.yml:
// parsed here, secondary files folded in, serialized back out. Compared
// verbatim, since this is what /v4 re-parses with interpolation off.
const serializedBasicCompose = `services:
  service1:
    build:
      context: 'service1'
      dockerfile: 'Dockerfile'
    command: null
    volumes:
      - 'resin-data:/data'
  service2:
    build:
      args:
        COMPOSE_ARG: 'an argument defined in the docker-compose.yml file'
      context: 'service2'
      dockerfile: 'Dockerfile-alt'
    command: null
    volumes:
      - 'resin-data:/data'
volumes:
  resin-data: {}
`;
// A fresh object per test, since the tar stream checker mutates it
const serializedBasicComposeEntry = (): ExpectedTarStreamFiles[string] => ({
	fileSize: Buffer.byteLength(serializedBasicCompose),
	type: 'file',
	contents: serializedBasicCompose,
});

const commonQueryParams = [
	['slug', 'gh_user/testApp'],
	['emulated', 'false'],
	['nocache', 'false'],
	['headless', 'false'],
	['isdraft', 'false'],
];

describe('balena push', function () {
	let api: MockHttpServer['api'];
	let builder: MockHttpServer['builder'];
	let server: MockHttpServer;
	const isWindows = process.platform === 'win32';

	before(async () => {
		server = new MockHttpServer();
		api = server.api;
		builder = server.builder;
		await server.start();
	});

	after(async () => {
		await server.stop();
	});

	beforeEach(async () => {
		await api.expectGetWhoAmI({ optional: true, persist: true });
		await api.expectGetApplication();
	});

	afterEach(async () => {
		// Check all expected api calls have been made and clean up.
		await server.assertAllCalled();
	});

	before(async () => {
		await setupDockerignoreTestData();
	});

	after(async () => {
		await setupDockerignoreTestData({ cleanup: true });
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
		const regSecretsPath = await addRegSecretsEntries(expectedFiles);
		const responseFilename = 'build-POST-v3.json';
		const responseBody = await fs.readFile(
			path.join(builderResponsePath, responseFilename),
			'utf8',
		);
		const expectedResponseLines = [
			...commonResponseLines[responseFilename],
			...getDockerignoreWarn1(
				[path.join(projectPath, 'src', '.dockerignore')],
				'push',
			),
		];
		if (isWindows) {
			const fname = path.join(projectPath, 'src', 'windows-crlf.sh');
			expectedResponseLines.push(
				`[Info] Converting line endings CRLF -> LF for file: ${fname}`,
			);
		}

		await testPushBuildStream({
			builderMock: builder,
			commandLine: `push testApp --source ${projectPath} -R ${regSecretsPath}`,
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
			'src/.dockerignore': { fileSize: 16, type: 'file' },
			'src/start.sh': { fileSize: 89, type: 'file' },
			'src/windows-crlf.sh': { fileSize: 70, type: 'file' },
			Dockerfile: { fileSize: 88, type: 'file' },
			'Dockerfile-alt': { fileSize: 30, type: 'file' },
		};
		const regSecretsPath = await addRegSecretsEntries(expectedFiles);
		const responseFilename = 'build-POST-v3.json';
		const responseBody = await fs.readFile(
			path.join(builderResponsePath, responseFilename),
			'utf8',
		);
		const expectedResponseLines = [
			...commonResponseLines[responseFilename],
			...getDockerignoreWarn1(
				[path.join(projectPath, 'src', '.dockerignore')],
				'push',
			),
		];
		const expectedQueryParams = [
			...commonQueryParams,
			['dockerfilePath', 'Dockerfile-alt'],
		];

		await testPushBuildStream({
			builderMock: builder,
			commandLine: `push testApp -s ${projectPath} -R ${regSecretsPath} --dockerfile Dockerfile-alt --noconvert-eol`,
			expectedFiles,
			expectedQueryParams,
			expectedResponseLines,
			projectPath,
			responseBody,
			responseCode: 200,
		});
	});

	it('should create the expected tar stream (single container, --noconvert-eol)', async () => {
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
		const regSecretsPath = await addRegSecretsEntries(expectedFiles);
		const responseFilename = 'build-POST-v3.json';
		const responseBody = await fs.readFile(
			path.join(builderResponsePath, responseFilename),
			'utf8',
		);
		const expectedResponseLines = [
			...commonResponseLines[responseFilename],
			...getDockerignoreWarn1(
				[path.join(projectPath, 'src', '.dockerignore')],
				'push',
			),
		];
		if (isWindows) {
			const fname = path.join(projectPath, 'src', 'windows-crlf.sh');
			expectedResponseLines.push(
				`[Warn] CRLF (Windows) line endings detected in file: ${fname}`,
				'[Warn] Windows-format line endings were detected in some files, but were not converted due to `--noconvert-eol` option.',
			);
		}

		await testPushBuildStream({
			builderMock: builder,
			commandLine: `push testApp -s ${projectPath} -R ${regSecretsPath} --noconvert-eol`,
			expectedFiles,
			expectedQueryParams: commonQueryParams,
			expectedResponseLines,
			projectPath,
			responseBody,
			responseCode: 200,
		});
	});

	it('should create the expected tar stream (single container, dockerignore1)', async () => {
		const projectPath = path.join(
			projectsPath,
			'no-docker-compose',
			'dockerignore1',
		);
		const expectedFiles: ExpectedTarStreamFiles = {
			'.balena/balena.yml': { fileSize: 12, type: 'file' },
			'.dockerignore': { fileSize: 438, type: 'file' },
			'.gitignore': { fileSize: 20, type: 'file' },
			'.git/foo.txt': { fileSize: 4, type: 'file' },
			'a.txt': { fileSize: 1, type: 'file' },
			'c.txt': { fileSize: 1, type: 'file' },
			Dockerfile: { fileSize: 13, type: 'file' },
			'src/.balena/balena.yml': { fileSize: 16, type: 'file' },
			'src/.gitignore': { fileSize: 10, type: 'file' },
			'src/src-a.txt': { fileSize: 5, type: 'file' },
			'src/src-c.txt': { fileSize: 5, type: 'file' },
			'vendor/.git/vendor-git-contents': { fileSize: 20, type: 'file' },
		};
		const regSecretsPath = await addRegSecretsEntries(expectedFiles);
		const responseFilename = 'build-POST-v3.json';
		const responseBody = await fs.readFile(
			path.join(builderResponsePath, responseFilename),
			'utf8',
		);

		await testPushBuildStream({
			builderMock: builder,
			commandLine: `push testApp -s ${projectPath} -R ${regSecretsPath}`,
			expectedFiles,
			expectedQueryParams: commonQueryParams,
			expectedResponseLines: commonResponseLines[responseFilename],
			projectPath,
			responseBody,
			responseCode: 200,
		});
	});

	// NOTE: if this test or other tests involving symbolic links fail on Windows
	// (with a mismatched fileSize 13 vs 5 for 'symlink-a.txt'), ensure that the
	// `core.symlinks` property is set to `true` in the `.git/config` file. Ref:
	// https://git-scm.com/docs/git-config#Documentation/git-config.txt-coresymlinks
	it('should create the expected tar stream (single container, symbolic links)', async () => {
		const projectPath = path.join(
			projectsPath,
			'no-docker-compose',
			'dockerignore2',
		);
		const expectedFiles: ExpectedTarStreamFiles = {
			'.dockerignore': { fileSize: 33, type: 'file' },
			'b.txt': { fileSize: 1, type: 'file' },
			Dockerfile: { fileSize: 13, type: 'file' },
			'lib/.dockerignore': { fileSize: 10, type: 'file' },
			'lib/src-b.txt': { fileSize: 5, type: 'file' },
			'src/src-b.txt': { fileSize: 5, type: 'file' },
			'symlink-a.txt': { fileSize: 5, type: 'file' },
		};
		const regSecretsPath = await addRegSecretsEntries(expectedFiles);
		const responseFilename = 'build-POST-v3.json';
		const responseBody = await fs.readFile(
			path.join(builderResponsePath, responseFilename),
			'utf8',
		);
		const expectedResponseLines = commonResponseLines[responseFilename];

		await testPushBuildStream({
			builderMock: builder,
			commandLine: `push testApp -s ${projectPath} -R ${regSecretsPath}`,
			expectedFiles,
			expectedQueryParams: commonQueryParams,
			expectedResponseLines,
			projectPath,
			responseBody,
			responseCode: 200,
		});
	});

	it('should create the expected tar stream (single container, --multi-dockerignore)', async () => {
		const projectPath = path.join(
			projectsPath,
			'no-docker-compose',
			'dockerignore2',
		);
		const expectedFiles: ExpectedTarStreamFiles = {
			'.dockerignore': { fileSize: 33, type: 'file' },
			'b.txt': { fileSize: 1, type: 'file' },
			Dockerfile: { fileSize: 13, type: 'file' },
			'lib/.dockerignore': { fileSize: 10, type: 'file' },
			'lib/src-b.txt': { fileSize: 5, type: 'file' },
			'src/src-b.txt': { fileSize: 5, type: 'file' },
			'symlink-a.txt': { fileSize: 5, type: 'file' },
		};
		const regSecretsPath = await addRegSecretsEntries(expectedFiles);
		const responseFilename = 'build-POST-v3.json';
		const responseBody = await fs.readFile(
			path.join(builderResponsePath, responseFilename),
			'utf8',
		);
		const expectedResponseLines: string[] = [
			...getDockerignoreWarn2(
				[path.join(projectPath, 'lib', '.dockerignore')],
				'push',
			),
			...commonResponseLines[responseFilename],
		];

		await testPushBuildStream({
			builderMock: builder,
			commandLine: `push testApp -s ${projectPath} -R ${regSecretsPath} -m`,
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
			'.balena/balena.yml': { fileSize: 197, type: 'file' },
			'docker-compose.yml': serializedBasicComposeEntry(),
			'service1/Dockerfile.template': { fileSize: 144, type: 'file' },
			'service1/file1.sh': { fileSize: 12, type: 'file' },
			'service2/Dockerfile-alt': { fileSize: 13, type: 'file' },
			'service2/file2-crlf.sh': {
				fileSize: isWindows ? 12 : 14,
				testStream: isWindows ? expectStreamNoCRLF : undefined,
				type: 'file',
			},
			'service2/src/file1.sh': { fileSize: 12, type: 'file' },
		};
		const regSecretsPath = await addRegSecretsEntries(expectedFiles);
		const responseFilename = 'build-POST-v3.json';
		const responseBody = await fs.readFile(
			path.join(builderResponsePath, responseFilename),
			'utf8',
		);
		const expectedResponseLines: string[] = [
			...commonResponseLines[responseFilename],
			...getDockerignoreWarn1(
				[path.join(projectPath, 'service2', '.dockerignore')],
				'push',
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

		await testPushBuildStream({
			builderMock: builder,
			commandLine: `push testApp -s ${projectPath} -R ${regSecretsPath}`,
			expectedFiles,
			expectedQueryParams: commonQueryParams,
			expectedResponseLines,
			projectPath,
			responseBody,
			responseCode: 200,
		});
	});

	it('should create the expected tar stream (docker-compose, --multi-dockerignore)', async () => {
		const projectPath = path.join(projectsPath, 'docker-compose', 'basic');
		const expectedFiles: ExpectedTarStreamFiles = {
			'.balena/balena.yml': { fileSize: 197, type: 'file' },
			'docker-compose.yml': serializedBasicComposeEntry(),
			'service1/Dockerfile.template': { fileSize: 144, type: 'file' },
			'service1/file1.sh': { fileSize: 12, type: 'file' },
			'service1/test-ignore.txt': { fileSize: 12, type: 'file' },
			'service2/Dockerfile-alt': { fileSize: 13, type: 'file' },
			'service2/.dockerignore': { fileSize: 12, type: 'file' },
			'service2/file2-crlf.sh': {
				fileSize: isWindows ? 12 : 14,
				testStream: isWindows ? expectStreamNoCRLF : undefined,
				type: 'file',
			},
		};
		const regSecretsPath = await addRegSecretsEntries(expectedFiles);
		const responseFilename = 'build-POST-v3.json';
		const responseBody = await fs.readFile(
			path.join(builderResponsePath, responseFilename),
			'utf8',
		);
		const expectedResponseLines: string[] = [
			...commonResponseLines[responseFilename],
			...getDockerignoreWarn3('push'),
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
			commandLine: `push testApp -s ${projectPath} -R ${regSecretsPath} -m`,
			expectedFiles,
			expectedQueryParams: commonQueryParams,
			expectedResponseLines,
			projectPath,
			responseBody,
			responseCode: 200,
		});
	});

	// Skip on Windows because this test uses Unix domain sockets
	itNoWin('should create the expected tar stream (socket file)', async () => {
		// This test creates project files dynamically in a temp dir, where
		// a Unix domain socket file is created and listened on. A specific
		// reason use use a temp dir is that Unix domain socket paths are
		// limited in length to just over 100 characters, while the project
		// paths in the test-data folder easily exceed that limit.
		const tmp = await import('tmp');
		tmp.setGracefulCleanup();
		const projectPath = await new Promise<string>((resolve, reject) => {
			const opts = { template: 'tmp-XXXXXX', unsafeCleanup: true };
			tmp.dir(opts, (e, p) => {
				if (e) {
					reject(e);
				} else {
					resolve(p);
				}
			});
		});
		console.error(`[debug] Temp project dir: ${projectPath}`);

		// Create a Unix Domain Socket file that should not be included in the tar stream
		const net = await import('net');
		const server = net.createServer();
		const socketPath = path.join(projectPath, 'socket');
		await new Promise<void>((resolve, reject) => {
			server.on('error', reject);
			try {
				server.listen(socketPath, resolve);
			} catch (e) {
				reject(e as Error);
			}
		});
		console.error(`[debug] Checking existence of socket at '${socketPath}'`);
		expect(await exists(socketPath), 'Socket existence').to.be.true;

		await fs.writeFile(path.join(projectPath, 'Dockerfile'), 'FROM busybox\n');

		const expectedFiles: ExpectedTarStreamFiles = {
			Dockerfile: { fileSize: 13, type: 'file' },
		};
		const responseFilename = 'build-POST-v3.json';
		const responseBody = await fs.readFile(
			path.join(builderResponsePath, responseFilename),
			'utf8',
		);

		await testPushBuildStream({
			builderMock: builder,
			commandLine: `push testApp -s ${projectPath}`,
			expectedFiles,
			expectedQueryParams: commonQueryParams,
			expectedResponseLines: commonResponseLines[responseFilename],
			projectPath,
			responseBody,
			responseCode: 200,
		});

		// Terminate Unix Domain Socket server
		await new Promise<void>((resolve, reject) => {
			server.close((e) => {
				if (e) {
					reject(e);
				} else {
					resolve();
				}
			});
		});

		expect(await exists(socketPath), 'Socket existence').to.be.false;
	});
});

describe('balena push: project validation', function () {
	let server: MockHttpServer;

	beforeEach(async () => {
		server = new MockHttpServer();
		await server.start();
	});

	afterEach(async () => {
		// Check all expected api calls have been made and clean up.
		await server.stop();
	});

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
		expect(cleanOutput(err, true)).to.include.members(expectedErrorLines);
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
		expect(cleanOutput(err, true)).to.include.members(expectedErrorLines);
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
			'Error: "docker-compose.y[a]ml" file found in parent directory: please check that',
			"the correct source folder was specified. (Suppress with '--noparent-check'.)",
		];

		const { out, err } = await runCommand(
			`push testApp --source ${projectPath} --nolive`,
		);
		expect(cleanOutput(err, true)).to.include.members(expectedErrorLines);
		expect(out).to.be.empty;
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
		expect(cleanOutput(err, true)).to.include.members(expectedErrorLines);
		expect(out).to.be.empty;
	});
});

// What the builder receives when the compose file uses secondary files and the
// shell environment
describe('balena push: compose file resolution before upload', function () {
	let api: MockHttpServer['api'];
	let builder: MockHttpServer['builder'];
	let server: MockHttpServer;

	before(async () => {
		server = new MockHttpServer();
		api = server.api;
		builder = server.builder;
		await server.start();
	});

	after(async () => {
		await server.stop();
	});

	beforeEach(async () => {
		await api.expectGetWhoAmI({ optional: true, persist: true });
		await api.expectGetApplication();
	});

	afterEach(async () => {
		await server.assertAllCalled();
	});

	const composeFile = (contents: string): ExpectedTarStreamFiles[string] => ({
		fileSize: Buffer.byteLength(contents),
		type: 'file',
		contents,
	});

	async function testResolvedCompose(
		projectPath: string,
		expectedFiles: ExpectedTarStreamFiles,
	) {
		const regSecretsPath = await addRegSecretsEntries(expectedFiles);
		const responseFilename = 'build-POST-v3.json';
		const responseBody = await fs.readFile(
			path.join(builderResponsePath, responseFilename),
			'utf8',
		);
		await testPushBuildStream({
			builderMock: builder,
			commandLine: `push testApp --source ${projectPath} -R ${regSecretsPath} --noconvert-eol`,
			expectedFiles,
			expectedQueryParams: commonQueryParams,
			expectedResponseLines: commonResponseLines[responseFilename],
			projectPath,
			responseBody,
			responseCode: 200,
		});
	}

	it('folds extends.file, env_file and label_file into the uploaded compose file', async () => {
		const projectPath = path.join(
			projectsPath,
			'docker-compose',
			'compose-fields',
		);
		// restart via extends, ENV_VAR via env_file, the label via label_file;
		// none of the three references survive
		const resolved = `networks:
  custom_network:
    ipam:
      config:
        - subnet: '172.16.0.0/24'
services:
  service1:
    annotations:
      com.example.foo: 'bar'
    build:
      context: 'service1'
      dockerfile: 'Dockerfile'
    command: null
    environment:
      ENV_VAR: 'env_value'
    healthcheck:
      start_period: '30s'
      test:
        - 'CMD'
        - 'echo'
        - 'ok'
    ipc: 'shareable'
    labels:
      com.example.label: 'value'
    networks:
      custom_network:
        aliases:
          - 'alias1'
        ipv4_address: '172.16.0.10'
    pids_limit: 100
    read_only: true
    restart: 'always'
    runtime: 'runc'
  service2:
    build:
      context: 'service2'
      dockerfile: 'Dockerfile-alt'
    command: null
    depends_on:
      - 'service1'
    network_mode: 'service:service1'
`;
		await testResolvedCompose(projectPath, {
			'.env': { fileSize: 18, type: 'file' },
			'base.yml': { fileSize: 38, type: 'file' },
			'labels.txt': { fileSize: 24, type: 'file' },
			'docker-compose.yml': composeFile(resolved),
			'service1/Dockerfile': { fileSize: 31, type: 'file' },
			'service2/Dockerfile-alt': { fileSize: 31, type: 'file' },
		});
	});

	it('folds an include into the uploaded compose file', async () => {
		const projectPath = path.join(
			projectsPath,
			'docker-compose',
			'compose-frag-ext-includes',
		);
		const resolved = `services:
  service1:
    build:
      args:
        SERVICE1_ARG: 's1_value'
        SHARED_ARG: 'shared_value'
      context: 'service1'
      dockerfile: 'Dockerfile'
    command: null
    restart: 'always'
    volumes:
      - 'resin-data:/data'
  service2:
    build:
      args:
        SERVICE2_ARG: 's2_value'
        SHARED_ARG: 'shared_value'
      context: 'service2'
      dockerfile: 'Dockerfile-alt'
    command: null
    restart: 'always'
    volumes:
      - 'resin-data:/data'
volumes:
  resin-data: {}
`;
		await testResolvedCompose(projectPath, {
			'compose-service2.yml': { fileSize: 252, type: 'file' },
			'docker-compose.yml': composeFile(resolved),
			'service1/Dockerfile': { fileSize: 31, type: 'file' },
			'service2/Dockerfile-alt': { fileSize: 31, type: 'file' },
		});
	});

	it('interpolates variables from the shell environment', async () => {
		const projectPath = path.join(
			projectsPath,
			'docker-compose',
			'interpolation',
		);
		const resolved = `services:
  main:
    build:
      context: 'service1'
      dockerfile: 'Dockerfile'
    command: null
    environment:
      GREETING: 'hello from the shell'
    labels:
      io.balena.test: 'label value'
`;
		const saved = {
			PUSH_TEST_GREETING: process.env.PUSH_TEST_GREETING,
			PUSH_TEST_LABEL: process.env.PUSH_TEST_LABEL,
		};
		process.env.PUSH_TEST_GREETING = 'hello from the shell';
		process.env.PUSH_TEST_LABEL = 'label value';
		try {
			await testResolvedCompose(projectPath, {
				'docker-compose.yml': composeFile(resolved),
				'service1/Dockerfile': { fileSize: 31, type: 'file' },
			});
		} finally {
			for (const [name, value] of Object.entries(saved)) {
				if (value == null) {
					delete process.env[name];
				} else {
					process.env[name] = value;
				}
			}
		}
	});
});
