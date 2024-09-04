/**
 * @license
 * Copyright 2019-2023 Balena Ltd.
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

import { BalenaAPIMock } from '../nock/balena-api-mock.js';
import { cleanOutput, runCommand } from '../helpers.js';

describe('balena whoami', function () {
	let api: BalenaAPIMock;

	this.beforeEach(() => {
		api = new BalenaAPIMock();
		api.expectGetMixpanel({ optional: true });
	});

	this.afterEach(async () => {
		// Check all expected api calls have been made and clean up.
		api.done();
	});

	it(`should output login required message if haven't logged in`, async () => {
		api.expectWhoAmIFail();
		const { err, out } = await runCommand('whoami');
		expect(out).to.be.empty;
		expect(err[0]).to.include('Login required');
	});

	it('should display device with device response', async () => {
		api.expectDeviceWhoAmI();
		const { err, out } = await runCommand('whoami');

		const lines = cleanOutput(out);
		expect(lines[0]).to.contain('== ACCOUNT INFORMATION');
		expect(lines[1]).to.contain('DEVICE: a11dc1acd31b623a0e4e084a6cf13aaa');
		expect(lines[2]).to.contain('URL:    balena-cloud.com');
		expect(err).to.be.empty;
	});

	it('should display application with application response', async () => {
		api.expectApplicationWhoAmI();
		const { err, out } = await runCommand('whoami');

		const lines = cleanOutput(out);
		expect(lines[0]).to.contain('== ACCOUNT INFORMATION');
		expect(lines[1]).to.contain('APPLICATION: mytestorf/mytestfleet');
		expect(lines[2]).to.contain('URL:         balena-cloud.com');
		expect(err).to.be.empty;
	});

	it('should display user with user response', async () => {
		api.expectGetWhoAmI();
		const { err, out } = await runCommand('whoami');

		const lines = cleanOutput(out);
		expect(lines[0]).to.contain('== ACCOUNT INFORMATION');
		expect(lines[1]).to.contain('USERNAME: gh_user');
		expect(lines[2]).to.contain('EMAIL:    testuser@test.com');
		expect(lines[3]).to.contain('URL:      balena-cloud.com');
		expect(err).to.be.empty;
	});
});
