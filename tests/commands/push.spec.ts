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

import { BalenaAPIMock } from '../nock/balena-api-mock';
import { BuilderMock, builderResponsePath } from '../nock/builder-mock';
import { expectStreamNoCRLF, testPushBuildStream } from '../docker-build';
import { cleanOutput, runCommand } from '../helpers';
import {
	addRegSecretsEntries,
	exists,
	ExpectedTarStreamFiles,
	getDockerignoreWarn1,
	getDockerignoreWarn2,
	getDockerignoreWarn3,
	setupDockerignoreTestData,
} from '../projects';

const repoPath = path.normalize(path.join(__dirname, '..', '..'));
const projectsPath = path.join(repoPath, 'tests', 'test-data', 'projects');

const itNoWin = process.platform === 'win32' ? it.skip : it;

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
	['slug', 'gh_user/testApp'],
	['dockerfilePath', ''],
	['emulated', 'false'],
	['nocache', 'false'],
	['headless', 'false'],
	['isdraft', 'false'],
];

describe('balena push', function () {
	let api: BalenaAPIMock;
	let builder: BuilderMock;
	const isWindows = process.platform === 'win32';

	this.beforeEach(() => {
		api = new BalenaAPIMock();
		builder = new BuilderMock();
		api.expectGetWhoAmI({ optional: true, persist: true });
		api.expectGetMixpanel({ optional: true });
		api.expectGetApplication();
	});

	this.afterEach(() => {
		// Check all expected api calls have been made and clean up.
		api.done();
		builder.done();
	});

	this.beforeAll(async () => {
		await setupDockerignoreTestData();
	});

	this.afterAll(async () => {
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
		const expectedQueryParams = commonQueryParams.map((i) =>
			i[0] === 'dockerfilePath' ? ['dockerfilePath', 'Dockerfile-alt'] : i,
		);

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
			'docker-compose.yml': { fileSize: 332, type: 'file' },
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
			'docker-compose.yml': { fileSize: 332, type: 'file' },
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
			tmp.dir(opts, (e, p) => (e ? reject(e) : resolve(p)));
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
				reject(e);
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
			server.close((e) => (e ? reject(e) : resolve()));
		});

		expect(await exists(socketPath), 'Socket existence').to.be.false;
	});
});

describe('balena push: project validation', function () {
	let api: BalenaAPIMock;

	this.beforeEach(() => {
		api = new BalenaAPIMock();
		api.expectGetMixpanel({ optional: true });
	});

	this.afterEach(() => {
		// Check all expected api calls have been made and clean up.
		api.done();
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
