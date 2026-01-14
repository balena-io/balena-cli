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
import * as sinon from 'sinon';
import { EventEmitter } from 'stream';
import type { Server } from 'net';
import { createServer } from 'net';

import { cleanOutput, runCommand } from '../../helpers.js';
import { MockHttpServer } from '../../mockserver.js';

// "itSS" means "it() Skip Standalone"
const itSS = process.env.BALENA_CLI_TEST_TYPE === 'standalone' ? it.skip : it;

describe('balena device ssh', function () {
	let api: MockHttpServer['api'];
	let server: MockHttpServer;

	let sshServer: Server;
	let sshServerPort: number;
	let hasSshExecutable = false;
	let mockedExitCode = 0;

	let spawnStub: sinon.SinonStub;

	before(async function () {
		hasSshExecutable = await checkSsh();
		if (!hasSshExecutable) {
			this.skip();
		}
		[sshServer, sshServerPort] = await startMockSshServer();
		server = new MockHttpServer();
		api = server.api;
		await server.start();
		await api.expectGetWhoAmI({ optional: true, persist: true });
	});

	after(async function () {
		if (sshServer) {
			sshServer.close();
		}
		await server.stop();
	});

	beforeEach(async function () {
		// Stub child_process.spawn for SSH mocking
		const childProcess = await import('child_process');
		spawnStub = sinon.stub(childProcess, 'spawn').callsFake(function (
			this: unknown,
			...fnArgs: unknown[]
		) {
			const [program, ...args] = fnArgs;
			if (typeof program === 'string' && program.includes('ssh')) {
				const emitter = new EventEmitter();
				setTimeout(() => emitter.emit('close', mockedExitCode), 1);
				return emitter;
			}
			// Call the original spawn for non-ssh commands
			return spawnStub!.wrappedMethod.apply(this, [program, ...args]);
		});
	});

	afterEach(async function () {
		// Restore the stub
		if (spawnStub) {
			spawnStub.restore();
		}
		// Check all expected api calls have been made and clean up.
		await server.assertAllCalled();
	});

	itSS('should succeed (mocked, device UUID)', async () => {
		const deviceUUID = 'abc1234';
		await api.expectGetWhoAmI({ optional: true, persist: true });
		await api.expectGetDevice({ fullUUID: deviceUUID, isConnectedToVpn: true });
		mockedExitCode = 0;

		const { err, out } = await runCommand(`device ssh ${deviceUUID}`);

		expect(err).to.be.empty;
		expect(out).to.be.empty;
	});

	itSS('should succeed (mocked, device IP address)', async () => {
		mockedExitCode = 0;
		const { err, out } = await runCommand(`device ssh 1.2.3.4`);
		expect(err).to.be.empty;
		expect(out).to.be.empty;
	});

	itSS(
		'should produce the expected error message (mocked, device UUID)',
		async () => {
			const deviceUUID = 'abc1234';
			const expectedErrLines = [
				'SSH: Remote command "host abc1234" exited with non-zero status code "255"',
			];
			await api.expectGetWhoAmI({ optional: true, persist: true });
			await api.expectGetDevice({
				fullUUID: deviceUUID,
				isConnectedToVpn: true,
			});
			mockedExitCode = 255;

			const { err, out } = await runCommand(`device ssh ${deviceUUID}`);
			expect(cleanOutput(err, true)).to.include.members(expectedErrLines);
			expect(out).to.be.empty;
		},
	);

	itSS('should fail if device not online (mocked, device UUID)', async () => {
		const deviceUUID = 'abc1234';
		const expectedErrLines = ['Device with UUID abc1234 is disconnected'];
		await api.expectGetWhoAmI({ optional: true, persist: true });
		await api.expectGetDevice({
			fullUUID: deviceUUID,
			isConnectedToVpn: false,
		});
		mockedExitCode = 0;

		const { err, out } = await runCommand(`device ssh ${deviceUUID}`);

		expect(cleanOutput(err, true)).to.include.members(expectedErrLines);
		expect(out).to.be.empty;
	});

	it('should produce the expected error message (real ssh, device IP address)', async function () {
		if (spawnStub) {
			spawnStub.restore();
		}

		const expectedErrLines = [
			'SSH: Process exited with non-zero status code "255"',
		];
		const { err, out } = await runCommand(
			`device ssh 127.0.0.1 -p ${sshServerPort} --noproxy`,
		);
		expect(cleanOutput(err, true)).to.include.members(expectedErrLines);
		expect(out).to.be.empty;
	});
});

/** Check whether the 'ssh' tool (executable) exists in the PATH */
async function checkSsh(): Promise<boolean> {
	const { which } = await import('../../../build/utils/which');
	const sshPath = await which('ssh', false);
	if ((sshPath ?? '').includes('\\Windows\\System32\\OpenSSH\\ssh')) {
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
		c.on('error', (err) => {
			handler(err.message);
		});
		c.on('end', () => {
			handler('client disconnected');
		});
		c.end();
	});

	return await new Promise<[Server, number]>((resolve, reject) => {
		server.on('error', (err) => {
			console.error(`mock ssh server error:\n${err}`);
			reject(err);
		});
		const listener = server.listen(0, '127.0.0.1', () => {
			const info = listener.address();
			if (info == null || typeof info !== 'object') {
				server.close();
				const err = new Error(
					`Test listener.address() did not return an object ${info}`,
				);
				reject(err);
				return;
			}
			console.error(
				`[Info] Mock ssh server listening on ${info.address}:${info.port}`,
			);
			resolve([server, info.port]);
		});
	});
}
