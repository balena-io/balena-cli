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

describe('balena tag set', function () {
	let api: MockHttpServer['api'];
	let server: MockHttpServer;

	const fullUUID = 'f63fd7d7812c34c4c14ae023fdff05f5';

	before(async () => {
		server = new MockHttpServer();
		api = server.api;
		await server.start();
		await api.expectGetWhoAmI({ optional: true, persist: true });
	});

	after(async () => {
		await server.stop();
	});

	afterEach(async () => {
		await server.assertAllCalled();
	});

	it('should successfully set a tag', async () => {
		await api.expectGetDevice({ fullUUID });
		await server.mockttp
			.forPost(/^\/v\d+\/device_tag($|\?)/)
			.thenReply(200, 'OK');

		const { out, err } = await runCommand(`tag set TEST 1 -d ${fullUUID}`);

		expect(out.join('')).to.equal('');
		expect(err.join('')).to.equal('');
	});

	it('should successfully set a tag w/o specifying a value', async () => {
		await api.expectGetDevice({ fullUUID });
		await server.mockttp
			.forPost(/^\/v\d+\/device_tag($|\?)/)
			.thenReply(200, 'OK');

		const { out, err } = await runCommand(
			`tag set TEST_NO_VALUE -d ${fullUUID}`,
		);

		expect(out.join('')).to.equal('');
		expect(err.join('')).to.equal('');
	});

	it('should successfully set a tag w/ empty string as a value', async () => {
		await api.expectGetDevice({ fullUUID });
		await server.mockttp
			.forPost(/^\/v\d+\/device_tag($|\?)/)
			.thenReply(200, 'OK');

		const { out, err } = await runCommand(
			`tag set TEST_EMPTY_STRING '' -d ${fullUUID}`,
		);

		expect(out.join('')).to.equal('');
		expect(err.join('')).to.equal('');
	});
});
