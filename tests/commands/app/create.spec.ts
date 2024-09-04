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
import { BalenaAPIMock } from '../../nock/balena-api-mock.js';
import { cleanOutput, runCommand } from '../../helpers.js';

const HELP_MESSAGE = '';

describe('balena app create', function () {
	let api: BalenaAPIMock;

	beforeEach(() => {
		api = new BalenaAPIMock();
	});

	afterEach(() => {
		// Check all expected api calls have been made and clean up.
		api.done();
	});

	// Temporarily skipped because of parse/checking order issue with -h
	it.skip('should print help text with the -h flag', async () => {
		api.expectGetWhoAmI({ optional: true });
		api.expectGetMixpanel({ optional: true });

		const { out, err } = await runCommand('app create -h');

		expect(cleanOutput(out)).to.deep.equal(cleanOutput([HELP_MESSAGE]));

		expect(err).to.eql([]);
	});
});
