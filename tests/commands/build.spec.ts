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

import { configureBluebird } from '../../build/app-common';

configureBluebird();

import { expect } from 'chai';
import { stripIndent } from 'common-tags';
import * as path from 'path';

import { BalenaAPIMock } from '../balena-api-mock';
import { DockerMock } from '../docker-mock';
import {
	cleanOutput,
	inspectTarStream,
	runCommand,
	TarStreamFiles,
} from '../helpers';

const repoPath = path.normalize(path.join(__dirname, '..', '..'));
const projectsPath = path.join(repoPath, 'tests', 'test-data', 'projects');

describe('balena build', function() {
	let api: BalenaAPIMock;
	let docker: DockerMock;

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

	it('should create the expected tar stream', async () => {
		const projectPath = path.join(projectsPath, 'no-docker-compose', 'basic');
		const expectedFiles: TarStreamFiles = {
			'src/start.sh': { fileSize: 89, type: 'file' },
			Dockerfile: { fileSize: 85, type: 'file' },
		};
		const responseBody = stripIndent`
			{"stream":"Step 1/4 : FROM busybox"}
			{"stream":"\\n"}
			{"stream":" ---\\u003e 64f5d945efcc\\n"}
			{"stream":"Step 2/4 : COPY ./src/start.sh /start.sh"}
			{"stream":"\\n"}
			{"stream":" ---\\u003e Using cache\\n"}
			{"stream":" ---\\u003e 97098fc9d757\\n"}
			{"stream":"Step 3/4 : RUN chmod a+x /start.sh"}
			{"stream":"\\n"}
			{"stream":" ---\\u003e Using cache\\n"}
			{"stream":" ---\\u003e 33728e2e3f7e\\n"}
			{"stream":"Step 4/4 : CMD [\\"/start.sh\\"]"}
			{"stream":"\\n"}
			{"stream":" ---\\u003e Using cache\\n"}
			{"stream":" ---\\u003e 2590e3b11eaf\\n"}
			{"aux":{"ID":"sha256:2590e3b11eaf739491235016b53fec5d209c81837160abdd267c8fe5005ff1bd"}}
			{"stream":"Successfully built 2590e3b11eaf\\n"}
			{"stream":"Successfully tagged basic_main:latest\\n"}`;

		docker.expectPostBuild({
			tag: 'basic_main',
			responseCode: 200,
			responseBody,
			checkBuildRequestBody: (buildRequestBody: string) =>
				inspectTarStream(buildRequestBody, expectedFiles, projectPath, expect),
		});

		const { out, err } = await runCommand(
			`build ${projectPath} --deviceType nuc --arch amd64`,
		);

		expect(err).to.have.members([]);
		expect(
			cleanOutput(out).map(line => line.replace(/\s{2,}/g, ' ')),
		).to.include.members([
			`[Info] Creating default composition with source: ${projectPath}`,
			'[Info] Building for amd64/nuc',
			'[Info] Docker Desktop detected (daemon architecture: "x86_64")',
			'[Info] Docker itself will determine and enable architecture emulation if required,',
			'[Info] without balena-cli intervention and regardless of the --emulated option.',
			'[Build] main Image size: 1.14 MB',
			'[Success] Build succeeded!',
		]);
	});
});
