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
import mock = require('mock-require');
import { createServer, Server } from 'net';

import { BalenaAPIMock } from '../balena-api-mock';
import { cleanOutput, runCommand } from '../helpers';

// "itSS" means "it() Skip Standalone"
const itSS = process.env.BALENA_CLI_TEST_TYPE === 'standalone' ? it.skip : it;

describe('balena ssh', function () {
	let api: BalenaAPIMock;
	let sshServer: Server | undefined;
	let sshServerPort: number;
	let hasSshExecutable = false;
	let mockedExitCode = 0;

	this.beforeAll(async function () {
		hasSshExecutable = await checkSsh();
		if (hasSshExecutable) {
			[sshServer, sshServerPort] = await startMockSshServer();
		}
		const modPath = '../../build/utils/helpers';
		const mod = await import(modPath);
		mock(modPath, {
			...mod,
			whichSpawn: async () => [mockedExitCode, undefined],
		});
	});

	this.afterAll(function () {
		if (sshServer) {
			sshServer.close();
			sshServer = undefined;
		}
		mock.stopAll();
	});

	this.beforeEach(() => {
		api = new BalenaAPIMock();
		api.expectGetMixpanel({ optional: true });
	});

	this.afterEach(() => {
		// Check all expected api calls have been made and clean up.
		api.done();
	});

	itSS('should succeed (mocked, device UUID)', async () => {
		const deviceUUID = 'abc1234';
		api.expectGetWhoAmI({ optional: true, persist: true });
		api.expectGetApplication({ notFound: true });
		api.expectGetDevice({ fullUUID: deviceUUID });
		mockedExitCode = 0;

		const { err, out } = await runCommand(`ssh ${deviceUUID}`);
		expect(err).to.be.empty;
		expect(out).to.be.empty;
	});

	itSS('should succeed (mocked, device IP address)', async () => {
		mockedExitCode = 0;
		const { err, out } = await runCommand(`ssh 1.2.3.4`);
		expect(err).to.be.empty;
		expect(out).to.be.empty;
	});

	itSS(
		'should produce the expected error message (mocked, device UUID)',
		async () => {
			const deviceUUID = 'abc1234';
			const expectedErrLines = [
				'Warning: ssh process exited with non-zero code "255"',
			];
			api.expectGetWhoAmI({ optional: true, persist: true });
			api.expectGetApplication({ notFound: true });
			api.expectGetDevice({ fullUUID: deviceUUID });
			mockedExitCode = 255;

			const { err, out } = await runCommand(`ssh ${deviceUUID}`);
			expect(cleanOutput(err, true)).to.include.members(expectedErrLines);
			expect(out).to.be.empty;
		},
	);

	it('should produce the expected error message (real ssh, device IP address)', async function () {
		if (!hasSshExecutable) {
			this.skip();
		}
		mock.stop('../../build/utils/helpers');
		const expectedErrLines = [
			'Warning: ssh process exited with non-zero code "255"',
		];
		const { err, out } = await runCommand(
			`ssh 127.0.0.1 -p ${sshServerPort} --noproxy`,
		);
		expect(cleanOutput(err, true)).to.include.members(expectedErrLines);
		expect(out).to.be.empty;
	});
});

/** Check whether the 'ssh' tool (executable) exists in the PATH */
async function checkSsh(): Promise<boolean> {
	const { which } = await import('../../build/utils/helpers');
	const sshPath = await which('ssh', false);
	if ((sshPath || '').includes('\\Windows\\System32\\OpenSSH\\ssh')) {
		// don't use Windows' built-in ssh tool for these test cases
		// because it messes up with the terminal window such that
		// "line breaks stop working" (and not even '\033c' fixes it)
		// and all mocha output gets printed on a single very long line...
		return false;
	}
	return !!sshPath;
}

/** Start a TCP server (listening socket), used as a mock ssh server */
async function startMockSshServer(): Promise<[Server, number]> {
	const server = createServer((c) => {
		// 'connection' listener
		const handler = (msg: string) => {
			if (process.env.DEBUG) {
				console.error(`[debug] mock ssh server: ${msg}`);
			}
		};
		c.on('error', (err) => handler(err.message));
		c.on('end', () => handler('client disconnected'));
		c.end();
	});
	server.on('error', (err) => {
		console.error(`mock ssh server error:\n${err}`);
	});

	return new Promise<[Server, number]>((resolve, reject) => {
		// port 0: let the OS allocation any available TCP port number
		const listener = server.listen(0, '127.0.0.1', (err: Error) => {
			// this callback is called for the 'listening' event
			if (err) {
				console.error(`Error starting mock ssh server:\n${err}`);
				reject(err);
			} else {
				const info: any = listener.address();
				console.error(
					`[Info] Mock ssh server listening on ${info.address}:${info.port}`,
				);
				resolve([server, info.port]);
			}
		});
	});
}
