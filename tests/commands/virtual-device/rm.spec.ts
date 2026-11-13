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
		{
			type?: string;
			description?: string;
			default?: unknown;
			exclusive?: string[];
		}
	>;
	args: Record<string, { description?: string; required?: boolean }>;
	description: string;
	examples: string[];
}

describe('virtual-device rm command structure', function () {
	let VirtualDeviceRmCmd: CommandModule;

	before(async function () {
		const module = (await import(
			'../../../build/commands/virtual-device/rm.js'
		)) as {
			default: {
				default?: CommandModule;
			} & CommandModule;
		};
		// Handle both direct default export and nested default.default pattern
		VirtualDeviceRmCmd = module.default.default ?? module.default;
	});

	describe('--all flag', function () {
		it('should have --all flag', function () {
			expect(VirtualDeviceRmCmd.flags).to.have.property('all');
		});

		it('should document --all in description', function () {
			expect(VirtualDeviceRmCmd.flags.all.description).to.include('all');
		});
	});

	describe('instance argument', function () {
		it('should have instance argument', function () {
			expect(VirtualDeviceRmCmd.args).to.have.property('instance');
		});

		it('should have instance argument as optional', function () {
			expect(VirtualDeviceRmCmd.args.instance.required).to.be.false;
		});

		it('should describe instance argument', function () {
			expect(VirtualDeviceRmCmd.args.instance.description).to.include(
				'instance',
			);
		});
	});

	describe('command description', function () {
		it('should have description', function () {
			expect(VirtualDeviceRmCmd.description).to.include('Remove');
			expect(VirtualDeviceRmCmd.description).to.include('virtual');
		});

		it('should mention working copy cleanup', function () {
			expect(VirtualDeviceRmCmd.description).to.include('working copy');
		});

		it('should mention permanently deletes', function () {
			expect(VirtualDeviceRmCmd.description).to.include('permanently');
		});

		it('should mention stop command for temporary stops', function () {
			expect(VirtualDeviceRmCmd.description).to.include('virt stop');
		});

		it('should document different identifier formats', function () {
			expect(VirtualDeviceRmCmd.description).to.include('container name');
			expect(VirtualDeviceRmCmd.description).to.include('number');
		});
	});

	describe('command examples', function () {
		it('should have examples', function () {
			expect(VirtualDeviceRmCmd.examples).to.be.an('array');
			expect(VirtualDeviceRmCmd.examples.length).to.be.greaterThan(0);
		});

		it('should show example for removing by instance number', function () {
			const hasNumberExample = VirtualDeviceRmCmd.examples.some(
				(ex) =>
					ex.includes('balena virtual-device rm 1') ||
					ex.includes('balena virt rm 1'),
			);
			expect(hasNumberExample, 'Should have example with instance number').to.be
				.true;
		});

		it('should show example for removing by instance name', function () {
			const hasInstanceExample = VirtualDeviceRmCmd.examples.some(
				(ex) =>
					ex.includes('balena virtual-device rm') && ex.includes('balenaos-vm'),
			);
			expect(hasInstanceExample, 'Should have example with instance name').to.be
				.true;
		});

		it('should show example for --all flag', function () {
			const hasAllExample = VirtualDeviceRmCmd.examples.some((ex) =>
				ex.includes('--all'),
			);
			expect(hasAllExample, 'Should have example with --all flag').to.be.true;
		});

		it('should include virt alias in examples', function () {
			const hasAliasExample = VirtualDeviceRmCmd.examples.some((ex) =>
				ex.includes('balena virt rm'),
			);
			expect(hasAliasExample, 'Should have virt alias example').to.be.true;
		});
	});
});

describe('balena virtual-device rm', function () {
	before(function () {
		skipIfNoDocker(this, 'virtual-device rm command tests');
	});

	it('should require instance argument or --all flag', async function () {
		const { out, err } = await runCommand('virtual-device rm');

		// Should show an error about missing instance or --all
		const output =
			cleanOutput(out, true).join(' ') + cleanOutput(err, true).join(' ');
		expect(output.toLowerCase()).to.include('instance');
	});

	it('should accept --all flag without parsing errors', async function () {
		const { err } = await runCommand('virtual-device rm --all');

		// Should not have parsing errors (may have runtime errors if no Docker)
		// The command should at least parse correctly
		const errorOutput = cleanOutput(err, true).join(' ').toLowerCase();
		expect(errorOutput).to.not.include('unexpected argument');
		expect(errorOutput).to.not.include('unknown flag');
	});

	it('should accept instance argument without parsing errors', async function () {
		const { err } = await runCommand('virtual-device rm balenaos-vm-1-12345');

		// Should not have parsing errors
		const errorOutput = cleanOutput(err, true).join(' ').toLowerCase();
		expect(errorOutput).to.not.include('unexpected argument');
		expect(errorOutput).to.not.include('unknown flag');
	});

	it('should accept numeric instance identifier', async function () {
		const { err } = await runCommand('virtual-device rm 1');

		// Should not have parsing errors
		const errorOutput = cleanOutput(err, true).join(' ').toLowerCase();
		expect(errorOutput).to.not.include('unexpected argument');
		expect(errorOutput).to.not.include('unknown flag');
	});

	it('should show helpful error when neither instance nor --all provided', async function () {
		const { out, err } = await runCommand('virtual-device rm');

		const output =
			cleanOutput(out, true).join(' ') + ' ' + cleanOutput(err, true).join(' ');

		// Should mention both instance and --all options
		expect(output).to.include('instance');
		expect(output).to.include('--all');
	});

	it('should show "No virtual devices to remove" when rm --all with no containers', async function () {
		const { out, err } = await runCommand('virtual-device rm --all');

		const output = cleanOutput(out, true).join(' ');

		// Either shows "No virtual devices to remove" or removes containers that exist
		// This test accepts both behaviors since it depends on actual Docker state
		expect(
			output.includes('No virtual devices to remove') ||
				output.includes('Removing'),
			'Should either show no devices or begin removing',
		).to.be.true;
		expect(err).to.eql([]);
	});

	it('should show error when removing non-existent instance', async function () {
		const { out, err } = await runCommand(
			'virtual-device rm nonexistent-container-xyz123',
		);

		const output =
			cleanOutput(out, true).join(' ') + ' ' + cleanOutput(err, true).join(' ');
		const lowerOutput = output.toLowerCase();

		// Should indicate not found
		expect(lowerOutput).to.satisfy(
			(o: string) => o.includes('not found') || o.includes('no such'),
			'Should indicate instance not found',
		);
	});

	it('should suggest running list command in error messages', async function () {
		const { out, err } = await runCommand(
			'virtual-device rm nonexistent-container-abc',
		);

		const output =
			cleanOutput(out, true).join(' ') + ' ' + cleanOutput(err, true).join(' ');

		// Should suggest running list command
		expect(output).to.include('virtual-device list');
	});
});
