/**
 * @license
 * Copyright 2024 Balena Ltd.
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

import { cleanOutput, runCommand, skipIfNoDocker } from './helpers';

describe('balena virt alias', function () {
	describe('command execution', function () {
		before(function () {
			skipIfNoDocker(this, 'virt alias command execution tests');
		});

		it('should make "virt list" work like "virtual-device list"', async function () {
			// Get output from both commands
			const { out: virtOut, err: virtErr } = await runCommand('virt list');
			const { out: fullOut, err: fullErr } = await runCommand(
				'virtual-device list',
			);

			// Both should succeed without error
			expect(virtErr).to.eql([]);
			expect(fullErr).to.eql([]);

			// Both should produce the same output
			const virtLines = cleanOutput(virtOut, true);
			const fullLines = cleanOutput(fullOut, true);

			expect(virtLines).to.deep.equal(fullLines);
		});
	});

	it('should make "virt start --help" work like "virtual-device start --help"', async function () {
		const { out: virtOut } = await runCommand('virt start --help');
		const { out: fullOut } = await runCommand('virtual-device start --help');

		const virtLines = cleanOutput(virtOut, true);
		const fullLines = cleanOutput(fullOut, true);

		// Help output should be identical
		expect(virtLines).to.deep.equal(fullLines);
	});

	it('should make "virt stop --help" work like "virtual-device stop --help"', async function () {
		const { out: virtOut } = await runCommand('virt stop --help');
		const { out: fullOut } = await runCommand('virtual-device stop --help');

		const virtLines = cleanOutput(virtOut, true);
		const fullLines = cleanOutput(fullOut, true);

		// Help output should be identical
		expect(virtLines).to.deep.equal(fullLines);
	});

	it('should show virt alias in help examples', async function () {
		const { out } = await runCommand('virtual-device list --help');
		const lines = cleanOutput(out, true);

		// Examples should include the virt alias
		expect(lines.some((line) => line.includes('balena virt list'))).to.be.true;
	});
});
