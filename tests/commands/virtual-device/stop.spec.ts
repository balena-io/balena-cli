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

describe('virtual-device stop command structure', function () {
	let VirtualDeviceStopCmd: CommandModule;

	before(async function () {
		const module = (await import(
			'../../../build/commands/virtual-device/stop.js'
		)) as {
			default: {
				default?: CommandModule;
			} & CommandModule;
		};
		// Handle both direct default export and nested default.default pattern
		VirtualDeviceStopCmd = module.default.default ?? module.default;
	});

	describe('--all flag', function () {
		it('should have --all flag', function () {
			expect(VirtualDeviceStopCmd.flags).to.have.property('all');
		});

		it('should document --all in description', function () {
			expect(VirtualDeviceStopCmd.flags.all.description).to.include('all');
		});
	});

	describe('instance argument', function () {
		it('should have instance argument', function () {
			expect(VirtualDeviceStopCmd.args).to.have.property('instance');
		});

		it('should have instance argument as optional', function () {
			expect(VirtualDeviceStopCmd.args.instance.required).to.be.false;
		});

		it('should describe instance argument', function () {
			expect(VirtualDeviceStopCmd.args.instance.description).to.include(
				'instance',
			);
		});
	});

	describe('command description', function () {
		it('should have description', function () {
			expect(VirtualDeviceStopCmd.description).to.include('Stop');
			expect(VirtualDeviceStopCmd.description).to.include('virtual');
		});

		it('should mention that container is preserved for restart', function () {
			expect(VirtualDeviceStopCmd.description).to.include('preserved');
			expect(VirtualDeviceStopCmd.description).to.include('restart');
		});

		it('should mention rm command for cleanup', function () {
			expect(VirtualDeviceStopCmd.description).to.include('virt rm');
		});

		it('should document different identifier formats', function () {
			expect(VirtualDeviceStopCmd.description).to.include('container name');
			expect(VirtualDeviceStopCmd.description).to.include('number');
		});
	});

	describe('command examples', function () {
		it('should have examples', function () {
			expect(VirtualDeviceStopCmd.examples).to.be.an('array');
			expect(VirtualDeviceStopCmd.examples.length).to.be.greaterThan(0);
		});

		it('should show example for stopping by instance number', function () {
			const hasNumberExample = VirtualDeviceStopCmd.examples.some(
				(ex) =>
					ex.includes('balena virtual-device stop 1') ||
					ex.includes('balena virt stop 1'),
			);
			expect(hasNumberExample, 'Should have example with instance number').to.be
				.true;
		});

		it('should show example for stopping by instance name', function () {
			const hasInstanceExample = VirtualDeviceStopCmd.examples.some(
				(ex) =>
					ex.includes('balena virtual-device stop') &&
					ex.includes('balenaos-vm'),
			);
			expect(hasInstanceExample, 'Should have example with instance name').to.be
				.true;
		});

		it('should show example for --all flag', function () {
			const hasAllExample = VirtualDeviceStopCmd.examples.some((ex) =>
				ex.includes('--all'),
			);
			expect(hasAllExample, 'Should have example with --all flag').to.be.true;
		});

		it('should include virt alias in examples', function () {
			const hasAliasExample = VirtualDeviceStopCmd.examples.some((ex) =>
				ex.includes('balena virt stop'),
			);
			expect(hasAliasExample, 'Should have virt alias example').to.be.true;
		});
	});
});

describe('balena virtual-device stop', function () {
	before(function () {
		skipIfNoDocker(this, 'virtual-device stop command tests');
	});

	it('should require instance argument or --all flag', async function () {
		const { out, err } = await runCommand('virtual-device stop');

		// Should show an error about missing instance or --all
		const output =
			cleanOutput(out, true).join(' ') + cleanOutput(err, true).join(' ');
		expect(output.toLowerCase()).to.include('instance');
	});

	it('should accept --all flag without parsing errors', async function () {
		const { err } = await runCommand('virtual-device stop --all');

		// Should not have parsing errors (may have runtime errors if no Docker)
		// The command should at least parse correctly
		const errorOutput = cleanOutput(err, true).join(' ').toLowerCase();
		expect(errorOutput).to.not.include('unexpected argument');
		expect(errorOutput).to.not.include('unknown flag');
	});

	it('should accept instance argument without parsing errors', async function () {
		const { err } = await runCommand('virtual-device stop balenaos-vm-1-12345');

		// Should not have parsing errors
		const errorOutput = cleanOutput(err, true).join(' ').toLowerCase();
		expect(errorOutput).to.not.include('unexpected argument');
		expect(errorOutput).to.not.include('unknown flag');
	});

	it('should accept numeric instance identifier', async function () {
		const { err } = await runCommand('virtual-device stop 1');

		// Should not have parsing errors
		const errorOutput = cleanOutput(err, true).join(' ').toLowerCase();
		expect(errorOutput).to.not.include('unexpected argument');
		expect(errorOutput).to.not.include('unknown flag');
	});

	it('should show helpful error when neither instance nor --all provided', async function () {
		const { out, err } = await runCommand('virtual-device stop');

		const output =
			cleanOutput(out, true).join(' ') + ' ' + cleanOutput(err, true).join(' ');

		// Should mention both instance and --all options
		expect(output).to.include('instance');
		expect(output).to.include('--all');
	});

	it('should show "No running virtual devices" when stop --all with no containers', async function () {
		const { out, err } = await runCommand('virtual-device stop --all');

		const output = cleanOutput(out, true).join(' ');

		// Either shows "No running virtual devices" or stops containers that exist
		// This test accepts both behaviors since it depends on actual Docker state
		expect(
			output.includes('No running virtual devices') ||
				output.includes('Stopping'),
			'Should either show no devices or begin stopping',
		).to.be.true;
		expect(err).to.eql([]);
	});

	it('should show error when stopping non-existent instance', async function () {
		const { out, err } = await runCommand(
			'virtual-device stop nonexistent-container-xyz123',
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
			'virtual-device stop nonexistent-container-abc',
		);

		const output =
			cleanOutput(out, true).join(' ') + ' ' + cleanOutput(err, true).join(' ');

		// Should suggest running list command
		expect(output).to.include('virtual-device list');
	});
});
