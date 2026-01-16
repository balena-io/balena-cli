/**
 * @license
 * Copyright 2025 Balena Ltd.
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

describe('balena release-asset list', function () {
	let api: MockHttpServer['api'];
	let server: MockHttpServer;

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

	it('should list release assets', async () => {
		await api.expectGetReleaseWithReleaseAssets();

		const { out } = await runCommand('release-asset list 27fda508c');
		const lines = cleanOutput(out);

		expect(lines.join(' ')).to.contain('config.json');
		expect(lines.join(' ')).to.contain('app.tar.gz');
		expect(lines.join(' ')).to.contain('1.02 KB');
		expect(lines.join(' ')).to.contain('5.24 MB');
	});

	it('should show message when no assets found', async () => {
		await api.expectGetReleaseWithReleaseAssets({ empty: true });

		const { out } = await runCommand('release-asset list 27fda508c');
		const lines = cleanOutput(out);

		expect(lines[0]).to.equal('No assets found for this release');
	});

	it('should list release assets as JSON with --json flag', async () => {
		await api.expectGetReleaseWithReleaseAssets();

		const { err, out } = await runCommand(
			'release-asset list 27fda508c --json',
		);
		expect(err).to.be.empty;

		const json = JSON.parse(out.join(''));
		expect(json).to.be.an('array');
		expect(json).to.have.lengthOf(2);
		expect(json[0].asset_key).to.equal('config.json');
		expect(json[0].asset.size).to.equal(1024);
		expect(json[1].asset_key).to.equal('app.tar.gz');
		expect(json[1].asset.size).to.equal(5242880);
	});
});
