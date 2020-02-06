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
import { DockerMock, dockerResponsePath } from '../docker-mock';
import {
	cleanOutput,
	expectStreamNoCRLF,
	inspectTarStream,
	runCommand,
	TarStreamFiles,
} from '../helpers';

const repoPath = path.normalize(path.join(__dirname, '..', '..'));
const projectsPath = path.join(repoPath, 'tests', 'test-data', 'projects');

const expectedResponses = {
	'build-POST.json': [
		'[Info] Building for amd64/nuc',
		'[Info] Docker Desktop detected (daemon architecture: "x86_64")',
		'[Info] Docker itself will determine and enable architecture emulation if required,',
		'[Info] without balena-cli intervention and regardless of the --emulated option.',
		'[Build] main Image size: 1.14 MB',
		'[Success] Build succeeded!',
	],
};

describe('balena build', function() {
	let api: BalenaAPIMock;
	let docker: DockerMock;

	const commonQueryParams = [
		['t', 'basic_main'],
		['buildargs', '{}'],
		['labels', ''],
	];

	this.beforeEach(() => {
		api = new BalenaAPIMock();
		docker = new DockerMock();
		api.expectGetWhoAmI({ optional: true, persist: true });
		api.expectGetMixpanel({ optional: true });
		docker.expectGetPing();
		docker.expectGetInfo();
		docker.expectGetVersion();
		docker.expectGetImages();
	});

	this.afterEach(() => {
		// Check all expected api calls have been made and clean up.
		api.done();
		docker.done();
	});

	it('should create the expected tar stream (single container)', async () => {
		const projectPath = path.join(projectsPath, 'no-docker-compose', 'basic');
		const expectedFiles: TarStreamFiles = {
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

		docker.expectPostBuild({
			tag: 'basic_main',
			responseCode: 200,
			responseBody,
			checkURI: async (uri: string) => {
				const url = new URL(uri, 'http://test.net/');
				const queryParams = Array.from(url.searchParams.entries());
				expect(queryParams).to.have.deep.members(commonQueryParams);
			},
			checkBuildRequestBody: (buildRequestBody: string) =>
				inspectTarStream(buildRequestBody, expectedFiles, projectPath, expect),
		});

		const { out, err } = await runCommand(
			`build ${projectPath} --deviceType nuc --arch amd64`,
		);

		const extraLines = [
			`[Info] Creating default composition with source: ${projectPath}`,
		];
		if (process.platform === 'win32') {
			extraLines.push(
				`[Warn] CRLF (Windows) line endings detected in file: ${path.join(
					projectPath,
					'src',
					'windows-crlf.sh',
				)}`,
			);
		}

		expect(err).to.have.members([]);
		expect(
			cleanOutput(out).map(line => line.replace(/\s{2,}/g, ' ')),
		).to.include.members([
			...expectedResponses[responseFilename],
			...extraLines,
		]);
	});

	it('should create the expected tar stream (single container, --convert-eol)', async () => {
		const windows = process.platform === 'win32';
		const projectPath = path.join(projectsPath, 'no-docker-compose', 'basic');
		const expectedFiles: TarStreamFiles = {
			'src/start.sh': { fileSize: 89, type: 'file' },
			'src/windows-crlf.sh': {
				fileSize: windows ? 68 : 70,
				type: 'file',
				testStream: windows ? expectStreamNoCRLF : undefined,
			},
			Dockerfile: { fileSize: 88, type: 'file' },
			'Dockerfile-alt': { fileSize: 30, type: 'file' },
		};
		const responseFilename = 'build-POST.json';
		const responseBody = await fs.readFile(
			path.join(dockerResponsePath, responseFilename),
			'utf8',
		);

		docker.expectPostBuild({
			tag: 'basic_main',
			responseCode: 200,
			responseBody,
			checkURI: async (uri: string) => {
				const url = new URL(uri, 'http://test.net/');
				const queryParams = Array.from(url.searchParams.entries());
				expect(queryParams).to.have.deep.members(commonQueryParams);
			},
			checkBuildRequestBody: (buildRequestBody: string) =>
				inspectTarStream(buildRequestBody, expectedFiles, projectPath, expect),
		});

		const { out, err } = await runCommand(
			`build ${projectPath} --deviceType nuc --arch amd64 --convert-eol`,
		);

		const extraLines = [
			`[Info] Creating default composition with source: ${projectPath}`,
		];
		if (windows) {
			extraLines.push(
				`[Info] Converting line endings CRLF -> LF for file: ${path.join(
					projectPath,
					'src',
					'windows-crlf.sh',
				)}`,
			);
		}

		expect(err).to.have.members([]);
		expect(
			cleanOutput(out).map(line => line.replace(/\s{2,}/g, ' ')),
		).to.include.members([
			...expectedResponses[responseFilename],
			...extraLines,
		]);
	});
});
