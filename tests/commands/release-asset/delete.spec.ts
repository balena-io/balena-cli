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
import { BalenaAPIMock } from '../../nock/balena-api-mock';
import { cleanOutput, runCommand } from '../../helpers';

describe('balena release-asset delete', function () {
	let api: BalenaAPIMock;

	beforeEach(() => {
		api = new BalenaAPIMock();
		api.expectGetWhoAmI({ optional: true, persist: true });
	});

	afterEach(() => {
		api.done();
	});

	it('should delete a release asset with --yes flag', async () => {
		api.expectGetRelease();
		api.expectDeleteReleaseAsset({ assetKey: 'config.json' });

		const { out, err } = await runCommand(
			'release-asset delete 27fda508c --key config.json --yes',
		);

		const lines = cleanOutput(out);
		expect(lines.join(' ')).to.contain('deleted successfully');
		expect(err).to.be.empty;
	});
});
