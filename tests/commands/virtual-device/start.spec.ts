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
			default?: unknown;
			description?: string;
			required?: boolean;
			char?: string;
		}
	>;
	args: Record<string, { description?: string; required?: boolean }>;
	description: string;
	examples: string[];
	authenticated: boolean;
}

describe('virtual-device start command structure', function () {
	let VirtualDeviceStartCmd: CommandModule;

	before(async function () {
		// Import and handle nested default export (CommonJS/ESM interop)
		const module = (await import(
			'../../../build/commands/virtual-device/start.js'
		)) as {
			default: { default?: CommandModule } & CommandModule;
		};
		// Handle both direct default export and nested default.default pattern
		VirtualDeviceStartCmd = module.default.default ?? module.default;
	});

	describe('--image flag', function () {
		it('should have --image flag (optional for restart)', function () {
			expect(VirtualDeviceStartCmd.flags).to.have.property('image');
			// image is no longer required - can restart with instance arg instead
			expect(VirtualDeviceStartCmd.flags.image.required).to.be.false;
		});

		it('should have -i as short alias for --image', function () {
			expect(VirtualDeviceStartCmd.flags.image.char).to.equal('i');
		});

		it('should document --image for new VMs', function () {
			expect(VirtualDeviceStartCmd.flags.image.description).to.include(
				'balenaOS',
			);
		});
	});

	describe('instance argument (for restart)', function () {
		it('should have instance argument', function () {
			expect(VirtualDeviceStartCmd.args).to.have.property('instance');
		});

		it('should have instance argument as optional', function () {
			expect(VirtualDeviceStartCmd.args.instance.required).to.be.false;
		});

		it('should describe instance argument for restarting', function () {
			expect(VirtualDeviceStartCmd.args.instance.description).to.include(
				'stopped',
			);
		});
	});

	describe('--data-size flag', function () {
		it('should have --data-size flag', function () {
			expect(VirtualDeviceStartCmd.flags).to.have.property('data-size');
		});

		it('should default to 8G', function () {
			expect(VirtualDeviceStartCmd.flags['data-size'].default).to.equal('8G');
		});

		it('should document partition size in description', function () {
			expect(VirtualDeviceStartCmd.flags['data-size'].description).to.include(
				'partition',
			);
		});
	});

	describe('--detached flag', function () {
		it('should have --detached flag', function () {
			expect(VirtualDeviceStartCmd.flags).to.have.property('detached');
		});

		it('should have -d as short alias for --detached', function () {
			expect(VirtualDeviceStartCmd.flags.detached.char).to.equal('d');
		});

		it('should default to false', function () {
			expect(VirtualDeviceStartCmd.flags.detached.default).to.be.false;
		});

		it('should document background behavior', function () {
			expect(VirtualDeviceStartCmd.flags.detached.description).to.include(
				'background',
			);
		});
	});

	describe('resource flags (--memory and --cpus)', function () {
		it('should accept --memory flag', function () {
			expect(VirtualDeviceStartCmd.flags).to.have.property('memory');
			expect(VirtualDeviceStartCmd.flags.memory.type).to.equal('option');
		});

		it('should accept --cpus flag', function () {
			expect(VirtualDeviceStartCmd.flags).to.have.property('cpus');
			expect(VirtualDeviceStartCmd.flags.cpus.type).to.equal('option');
		});

		it('should have default of 2048 for --memory', function () {
			expect(VirtualDeviceStartCmd.flags.memory.default).to.equal(2048);
		});

		it('should have default of 4 for --cpus', function () {
			expect(VirtualDeviceStartCmd.flags.cpus.default).to.equal(4);
		});

		it('should document --memory in help text', function () {
			expect(VirtualDeviceStartCmd.flags.memory.description).to.include(
				'memory',
			);
			expect(VirtualDeviceStartCmd.flags.memory.description).to.include('MB');
		});

		it('should document --cpus in help text', function () {
			expect(VirtualDeviceStartCmd.flags.cpus.description).to.include('CPU');
		});
	});

	describe('command description', function () {
		it('should have a description', function () {
			expect(VirtualDeviceStartCmd.description).to.be.a('string');
			expect(VirtualDeviceStartCmd.description.length).to.be.greaterThan(0);
		});

		it('should mention QEMU in description', function () {
			expect(VirtualDeviceStartCmd.description).to.include('QEMU');
		});

		it('should mention workflow example', function () {
			expect(VirtualDeviceStartCmd.description).to.include('WORKFLOW');
		});

		it('should document keyboard controls', function () {
			expect(VirtualDeviceStartCmd.description).to.include('Ctrl+C');
			expect(VirtualDeviceStartCmd.description).to.include('Ctrl+P');
		});

		it('should document restarting stopped VMs', function () {
			expect(VirtualDeviceStartCmd.description).to.include('RESTARTING');
			expect(VirtualDeviceStartCmd.description).to.include('stopped');
		});

		it('should document VM lifecycle commands', function () {
			expect(VirtualDeviceStartCmd.description).to.include('virt stop');
			expect(VirtualDeviceStartCmd.description).to.include('virt rm');
		});
	});

	describe('command examples', function () {
		it('should have examples', function () {
			expect(VirtualDeviceStartCmd.examples).to.be.an('array');
			expect(VirtualDeviceStartCmd.examples.length).to.be.greaterThan(0);
		});

		it('should include example with --image flag', function () {
			const hasImageExample = VirtualDeviceStartCmd.examples.some(
				(ex) => ex.includes('--image') || ex.includes('-i'),
			);
			expect(hasImageExample, 'Should have --image example').to.be.true;
		});

		it('should include example with --detached flag', function () {
			const hasDetachedExample = VirtualDeviceStartCmd.examples.some((ex) =>
				ex.includes('--detached'),
			);
			expect(hasDetachedExample, 'Should have --detached example').to.be.true;
		});

		it('should include virt alias in examples', function () {
			const hasAliasExample = VirtualDeviceStartCmd.examples.some((ex) =>
				ex.includes('balena virt'),
			);
			expect(hasAliasExample, 'Should have virt alias example').to.be.true;
		});

		it('should include SSH example', function () {
			const hasSshExample = VirtualDeviceStartCmd.examples.some((ex) =>
				ex.includes('ssh'),
			);
			expect(hasSshExample, 'Should have SSH example').to.be.true;
		});

		it('should include restart example', function () {
			const hasRestartExample = VirtualDeviceStartCmd.examples.some(
				(ex) =>
					ex.includes('balena virt start 1') ||
					ex.includes('balena virtual-device start 1'),
			);
			expect(hasRestartExample, 'Should have restart example').to.be.true;
		});
	});

	describe('authentication', function () {
		it('should not require authentication', function () {
			expect(VirtualDeviceStartCmd.authenticated).to.be.false;
		});
	});
});

describe('balena virtual-device start', function () {
	before(function () {
		skipIfNoDocker(this, 'virtual-device start command tests');
	});

	// Reset process.exitCode after each test since CLI commands may set it
	afterEach(function () {
		process.exitCode = undefined;
	});

	it('should show error when neither --image nor instance provided', async function () {
		const { out, err } = await runCommand('virtual-device start');

		const output =
			cleanOutput(out, true).join(' ') + ' ' + cleanOutput(err, true).join(' ');

		// Should indicate that either --image or instance is required
		expect(output).to.include('--image');
		expect(output).to.include('instance');
	});

	it('should show error when image file does not exist', async function () {
		const { out, err } = await runCommand(
			'virtual-device start --image /nonexistent/path/to/image.img',
		);

		const output =
			cleanOutput(out, true).join(' ') + ' ' + cleanOutput(err, true).join(' ');
		const lowerOutput = output.toLowerCase();

		// Should indicate file not found
		expect(lowerOutput).to.satisfy(
			(o: string) => o.includes('not found') || o.includes('no such file'),
			'Should indicate file not found',
		);
	});

	it('should accept instance argument for restart without parsing errors', async function () {
		const { err } = await runCommand('virtual-device start 1');

		// Should not have parsing errors
		const errorOutput = cleanOutput(err, true).join(' ').toLowerCase();
		expect(errorOutput).to.not.include('unexpected argument');
		expect(errorOutput).to.not.include('unknown flag');
	});

	it('should show error when restarting non-existent instance', async function () {
		const { out, err } = await runCommand(
			'virtual-device start nonexistent-vm-xyz',
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

	it('should suggest list command when restart instance not found', async function () {
		const { out, err } = await runCommand(
			'virtual-device start nonexistent-vm-abc',
		);

		const output =
			cleanOutput(out, true).join(' ') + ' ' + cleanOutput(err, true).join(' ');

		// Should suggest running list command
		expect(output).to.include('virtual-device list');
	});
});
