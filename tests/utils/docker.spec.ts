/**
 * @license
 * Copyright 2022 Balena Ltd.
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

import type { DockerConnectionCliFlags } from '../../build/utils/docker';
import {
	generateConnectOpts,
	getDefaultDockerModemOpts,
} from '../../build/utils/docker';

const defaultSocketPath =
	process.platform === 'win32'
		? '//./pipe/docker_engine'
		: '/var/run/docker.sock';

describe('getDefaultDockerModemOpts() function', function () {
	it('should use a Unix socket when --dockerHost is not used', async () => {
		const cliFlags: DockerConnectionCliFlags = {
			dockerPort: 2376,
		};
		const defaultOps = getDefaultDockerModemOpts(cliFlags);
		expect(defaultOps).to.deep.include({
			host: undefined,
			port: undefined,
			protocol: 'http',
		});
		if (typeof defaultOps.socketPath === 'function') {
			// Function is always findDefaultUnixSocket(), which returns a promise.
			// Must override type since @types/dockerode not updated yet.
			const socketPath: () => Promise<string> = defaultOps.socketPath;
			expect(await socketPath()).to.equal(defaultSocketPath);
		} else {
			expect(defaultOps.socketPath).to.equal(defaultSocketPath);
		}
	});

	it('should use the HTTP protocol when --dockerPort is 2375', () => {
		const cliFlags: DockerConnectionCliFlags = {
			dockerHost: 'foo',
			dockerPort: 2375,
		};
		const defaultOps = getDefaultDockerModemOpts(cliFlags);
		expect(defaultOps).to.deep.include({
			host: 'foo',
			port: '2375',
			protocol: 'http',
			socketPath: undefined,
		});
	});

	it('should use the HTTPS protocol when --dockerPort is 2376', () => {
		const cliFlags: DockerConnectionCliFlags = {
			dockerHost: 'foo',
			dockerPort: 2376,
		};
		const defaultOps = getDefaultDockerModemOpts(cliFlags);
		expect(defaultOps).to.deep.include({
			host: 'foo',
			port: '2376',
			protocol: 'https',
			socketPath: undefined,
		});
	});
});

describe('generateConnectOpts() function', function () {
	it('should use a Unix socket when --docker is used', async () => {
		const cliFlags: DockerConnectionCliFlags = {
			docker: 'foo',
		};
		const connectOpts = await generateConnectOpts(cliFlags);
		expect(connectOpts).to.deep.include({
			protocol: 'http',
			socketPath: 'foo',
		});
		expect(connectOpts).to.not.have.any.keys('host', 'port');
	});

	it('should use the HTTP protocol when --dockerPort is 2375', async () => {
		const cliFlags: DockerConnectionCliFlags = {
			dockerHost: 'foo',
			dockerPort: 2375,
		};
		const connectOpts = await generateConnectOpts(cliFlags);
		expect(connectOpts).to.deep.include({
			host: 'foo',
			port: 2375,
			protocol: 'http',
		});
		expect(connectOpts).to.not.have.any.keys('socketPath');
	});

	it('should use the HTTPS protocol when --dockerPort is 2376', async () => {
		const cliFlags: DockerConnectionCliFlags = {
			dockerHost: 'foo',
			dockerPort: 2376,
		};
		const connectOpts = await generateConnectOpts(cliFlags);
		expect(connectOpts).to.deep.include({
			host: 'foo',
			port: 2376,
			protocol: 'https',
		});
		expect(connectOpts).to.not.have.any.keys('socketPath');
	});

	it('should use the HTTPS protocol when ca/cert/key are used', async () => {
		const path = await import('path');
		const aFile = path.join(
			import.meta.dirname,
			'../test-data/projects/no-docker-compose/dockerignore1/a.txt',
		);
		const cliFlags: DockerConnectionCliFlags = {
			ca: aFile,
			cert: aFile,
			key: aFile,
		};
		const connectOpts = await generateConnectOpts(cliFlags);
		expect(connectOpts).to.deep.include({
			ca: 'a',
			cert: 'a',
			key: 'a',
			host: undefined,
			port: undefined,
			protocol: 'https',
		});
		if (typeof connectOpts.socketPath === 'function') {
			// Function is always findDefaultUnixSocket(), which returns a promise.
			// Must override type since @types/dockerode not updated yet.
			const socketPath: () => Promise<string> = connectOpts.socketPath;
			expect(await socketPath()).to.equal(defaultSocketPath);
		} else {
			expect(connectOpts.socketPath).to.equal(defaultSocketPath);
		}
	});
});
