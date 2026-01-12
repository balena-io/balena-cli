/**
 * @license
 * Copyright 2019-2020 Balena Ltd.
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

import { runCommand } from '../../helpers.js';
import { MockHttpServer } from '../../mockserver.js';

describe('balena env rm', function () {
	let server: MockHttpServer;

	before(async () => {
		server = new MockHttpServer();
		await server.start();
		await server.api.expectGetWhoAmI({ optional: true, persist: true });
	});

	after(async () => {
		await server.stop();
	});

	afterEach(async () => {
		await server.assertAllCalled();
	});

	it('should successfully delete an environment variable', async () => {
		await server.mockttp
			.forDelete(/device_environment_variable/)
			.thenReply(200, 'OK');

		const { out, err } = await runCommand('env rm 144690 -d -y');

		expect(out.join('')).to.equal('');
		expect(err.join('')).to.equal('');
	});
});
