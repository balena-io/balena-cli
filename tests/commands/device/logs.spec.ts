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

import { cleanOutput, runCommand } from '../../helpers.js';
import { MockHttpServer } from '../../mockserver.js';

describe('balena device logs', function () {
	let supervisor: MockHttpServer['supervisor'];
	let server: MockHttpServer;

	before(async () => {
		server = new MockHttpServer();
		supervisor = server.supervisor;
		await server.start();
	});

	after(async () => {
		await server.stop();
	});

	afterEach(async () => {
		await server.assertAllCalled();
	});

	it('should reach the expected endpoints on a local device', async () => {
		await supervisor.expectGetPing();
		await supervisor.expectGetLogs();
		await supervisor.expectGetLogs();

		const { err, out } = await runCommand('device logs 1.2.3.4 --max-retry 1');

		const errLines = cleanOutput(err, true);
		const errMsg =
			'Max retry count (1) exceeded while attempting to reconnect to the device';
		if (process.env.DEBUG) {
			expect(errLines).to.include(errMsg);
		} else {
			expect(errLines).to.have.members([errMsg]);
		}

		const removeTimestamps = (logLine: string) =>
			logLine.replace(/(?<=\[Logs\]) \[.+?\]/, '');
		const cleanedOut = cleanOutput(out, true).map((l) => removeTimestamps(l));

		expect(cleanedOut).to.have.members([
			'[Logs] Streaming logs',
			'[Logs] [bar] bar 8 (332) Linux 4e3f81149d71 4.19.75 #1 SMP PREEMPT Mon Mar 23 11:50:49 UTC 2020 aarch64 GNU/Linux',
			'[Logs] [foo] foo 8 (200) Linux cc5df60d89ee 4.19.75 #1 SMP PREEMPT Mon Mar 23 11:50:49 UTC 2020 aarch64 GNU/Linux',
			'[Warn] Connection to device lost',
			'Retrying "Streaming logs" after 1.0s (1 of 1) due to: DeviceConnectionLostError: Connection to device lost',
			'[Logs] Streaming logs',
			'[Logs] [bar] bar 8 (332) Linux 4e3f81149d71 4.19.75 #1 SMP PREEMPT Mon Mar 23 11:50:49 UTC 2020 aarch64 GNU/Linux',
			'[Logs] [foo] foo 8 (200) Linux cc5df60d89ee 4.19.75 #1 SMP PREEMPT Mon Mar 23 11:50:49 UTC 2020 aarch64 GNU/Linux',
			'[Warn] Connection to device lost',
		]);
	});
});
