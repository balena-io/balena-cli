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
import { stripIndent } from '../../../build/utils/lazy.js';
import { MockHttpServer } from '../../mockserver.js';

describe('balena env rename', function () {
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

	// Tests the custom error augmentation
	it('should fail when not provising any parameter', async () => {
		const { err } = await runCommand('env rename');
		expect(
			err.flatMap((line) => line.split('\n')).filter((line) => line !== ''),
		).to.deep.equal(
			stripIndent`
			Missing 2 required arguments:
			id    : variable's numeric database ID
			value : variable value; if omitted, use value from this process' environment
			See more help with \`balena env rename --help\`
		`.split('\n'),
		);
	});

	it('should successfully rename an environment variable', async () => {
		await server.mockttp
			.forPatch(/device_environment_variable\(376\)/)
			.thenReply(200, 'OK');

		const { out, err } = await runCommand('env rename 376 emacs --device');

		expect(out.join('')).to.equal('');
		expect(err.join('')).to.equal('');
	});
});
