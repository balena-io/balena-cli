/**
 * @license
 * Copyright 2026 Balena Ltd.
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

import { cleanOutput, runCommand, skipIfNoDocker } from '../../helpers';

// Common type for command exports
interface CommandModule {
	flags: Record<
		string,
		{ type?: string; description?: string; default?: unknown }
	>;
	description: string;
	examples: string[];
	enableJsonFlag: boolean;
}

describe('virtual-device list command structure', function () {
	let VirtualDeviceListCmd: CommandModule;

	before(async function () {
		const module = (await import(
			'../../../build/commands/virtual-device/list.js'
		)) as {
			default: {
				default?: CommandModule;
			} & CommandModule;
		};
		// Handle both direct default export and nested default.default pattern
		VirtualDeviceListCmd = module.default.default ?? module.default;
	});

	it('should have enableJsonFlag set to true', function () {
		expect(VirtualDeviceListCmd.enableJsonFlag).to.be.true;
	});

	it('should have description', function () {
		expect(VirtualDeviceListCmd.description).to.include('List');
		expect(VirtualDeviceListCmd.description).to.include('virtual');
	});

	it('should mention detached mode context in description', function () {
		expect(VirtualDeviceListCmd.description).to.include('detached');
	});

	it('should have examples', function () {
		expect(VirtualDeviceListCmd.examples).to.be.an('array');
		expect(VirtualDeviceListCmd.examples.length).to.be.greaterThan(0);
		expect(VirtualDeviceListCmd.examples[0]).to.include(
			'balena virtual-device list',
		);
	});

	it('should include virt alias in examples', function () {
		const hasAliasExample = VirtualDeviceListCmd.examples.some((ex) =>
			ex.includes('balena virt list'),
		);
		expect(hasAliasExample, 'Should have virt alias example').to.be.true;
	});

	it('should include --json example', function () {
		const hasJsonExample = VirtualDeviceListCmd.examples.some((ex) =>
			ex.includes('--json'),
		);
		expect(hasJsonExample, 'Should have --json example').to.be.true;
	});
});

describe('balena virtual-device list', function () {
	before(function () {
		skipIfNoDocker(this, 'virtual-device list command tests');
	});

	it('should show either table or empty state message', async function () {
		const { out, err } = await runCommand('virtual-device list');

		const lines = cleanOutput(out, true);

		// Should either show empty message or a table with headers
		const hasEmptyMessage = lines.some((line) =>
			line.includes('No virtual devices running'),
		);
		const hasTableHeaders =
			lines.some((line) => line.includes('ID')) &&
			lines.some((line) => line.includes('STATUS'));

		expect(
			hasEmptyMessage || hasTableHeaders,
			'Should show either empty message or table headers',
		).to.be.true;
		expect(err).to.eql([]);
	});

	it('should show SSH command format when instances exist', async function () {
		const { out, err } = await runCommand('virtual-device list');

		const lines = cleanOutput(out, true);

		// If there are instances (has table headers), check for SSH command format
		const hasTableHeaders =
			lines.some((line) => line.includes('ID')) &&
			lines.some((line) => line.includes('STATUS'));

		if (hasTableHeaders) {
			// SSH command should follow pattern: ssh root@localhost -p <port>
			expect(lines).to.satisfy((l: string[]) =>
				l.some((line) => line.includes('ssh root@localhost -p')),
			);
		}

		expect(err).to.eql([]);
	});

	it('should show start command hint when no instances', async function () {
		const { out, err } = await runCommand('virtual-device list');

		const lines = cleanOutput(out, true);

		// If empty, should show hint to start
		const hasEmptyMessage = lines.some((line) =>
			line.includes('No virtual devices running'),
		);

		if (hasEmptyMessage) {
			const output = lines.join(' ');
			expect(output).to.include('balena virtual-device start');
		}

		expect(err).to.eql([]);
	});

	it('should support --json flag', async function () {
		const { out, err } = await runCommand('virtual-device list --json');

		const output = cleanOutput(out, true).join('');

		// Should be valid JSON (array format)
		expect(output).to.match(/^\[.*\]$/s);

		expect(err).to.eql([]);
	});
});
