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

import { Flags, Args, Command } from '@oclif/core';
import { ExpectedError } from '../../errors';
import { stripIndent } from '../../utils/lazy';
import { extractInstanceId } from '../../utils/virtual-device';
import {
	DEFAULT_MEMORY,
	DEFAULT_CPUS,
} from '../../utils/virtual-device/docker';

export default class VirtualDeviceStartCmd extends Command {
	public static description = stripIndent`
		Start a virtual balenaOS device.

		Start a virtual balenaOS device using QEMU emulation in Docker.
		This enables local testing of balenaOS deployments without physical hardware.

		STARTING A NEW VM:
		Use --image to start a new VM from a balenaOS image file.

		RESTARTING A STOPPED VM:
		Provide an instance identifier (number, name, or ID) to restart a
		previously stopped VM. Use 'balena virt list' to see stopped instances.

		COMPLETE WORKFLOW EXAMPLE:

		  Step 1: Download a balenaOS image
		    $ balena os download generic-amd64 -o balena.img --version default

		  Step 2: Configure the image (--dev enables SSH access)
		    $ balena os configure balena.img --fleet myFleet --dev

		  Step 3: Start the virtual device
		    $ balena virt start --image balena.img

		  Step 4: Connect via SSH (once booted, typically 30-60 seconds)
		    $ ssh root@localhost -p 22222

		SSH ACCESS: The --dev flag in 'os configure' enables development mode,
		which allows SSH access with the root user. Alternatively, you can add
		SSH keys to config.json before configuring the image. Without --dev or
		SSH keys, you can only interact via the serial console.

		The image file must be uncompressed (raw format). If you downloaded
		a compressed image (.gz or .zip), decompress it first with gunzip.

		INTERACTIVE MODE (default):
		By default, the command attaches to the VM's serial console interactively.
		You can type directly into the console and interact with the VM.

		Keyboard controls:
		  Ctrl+C         - Stop the virtual device and clean up
		  Ctrl+P, Ctrl+Q - Detach (VM keeps running in background)
		  Ctrl+A, C      - Access QEMU monitor (type 'quit' to exit)

		DETACHED MODE (--detached):
		Use --detached to start the virtual device in the background.
		This is useful for scripting or when you want to manage multiple VMs.

		VM LIFECYCLE:
		  - 'balena virt stop' stops a VM but preserves it for restart
		  - 'balena virt rm' removes a VM and cleans up its working copy
	`;

	public static examples = [
		'$ balena os download generic-amd64 -o balena.img --version default',
		'$ balena os configure balena.img --fleet myFleet --dev',
		'$ balena virt start --image balena.img',
		'$ ssh root@localhost -p 22222',
		'$ balena virtual-device start --image balena.img --detached',
		'$ balena virtual-device start --image balena.img --data-size 16G',
		'$ balena virtual-device start --image balena.img --memory 4096 --cpus 2',
		'$ balena virt start 1  # restart stopped instance 1',
	];

	public static args = {
		instance: Args.string({
			description: 'Name, number, or ID of a stopped instance to restart',
			required: false,
		}),
	};

	public static flags = {
		image: Flags.string({
			description: 'path to the balenaOS image file (for new VMs)',
			char: 'i',
			required: false,
		}),
		'data-size': Flags.string({
			description: 'data partition size (e.g., 8G, 16G)',
			default: '8G',
		}),
		detached: Flags.boolean({
			description: 'run in background (do not stream logs)',
			char: 'd',
			default: false,
		}),
		memory: Flags.integer({
			description: 'VM memory in MB',
			default: DEFAULT_MEMORY,
		}),
		cpus: Flags.integer({
			description: 'VM CPU cores',
			default: DEFAULT_CPUS,
		}),
	};

	public static authenticated = false;

	public async run() {
		const { args: params, flags: options } = await this.parse(
			VirtualDeviceStartCmd,
		);

		// Determine if this is a restart of an existing instance or a new VM
		if (params.instance) {
			await this.restartInstance(params.instance, options);
		} else if (options.image) {
			await this.startNewVm({ ...options, image: options.image });
		} else {
			throw new ExpectedError(
				'You must specify either --image to start a new VM or an instance identifier to restart a stopped one.\n\n' +
					'Usage:\n' +
					'  balena virt start --image <path>  Start a new VM\n' +
					'  balena virt start <instance>      Restart a stopped VM\n\n' +
					'Run "balena virtual-device list" to see existing instances.',
			);
		}
	}

	/**
	 * Restart a stopped VM instance.
	 */
	private async restartInstance(
		identifier: string,
		options: { detached: boolean },
	) {
		const { findContainer, startContainer } = await import(
			'../../utils/virtual-device'
		);

		console.log(`Restarting virtual device: ${identifier}...\n`);

		// Find the container
		const { instance: existingInstance, workingCopyPath } =
			await findContainer(identifier);

		if (!existingInstance) {
			throw new ExpectedError(
				`Virtual device not found: ${identifier}\n\n` +
					'Run "balena virtual-device list" to see existing instances.',
			);
		}

		if (existingInstance.status === 'running') {
			throw new ExpectedError(
				`Virtual device ${existingInstance.name} is already running.\n\n` +
					`SSH: ssh root@localhost -p ${existingInstance.sshPort}`,
			);
		}

		// Start the container
		const instance = await startContainer(existingInstance.containerId);

		// Print success info
		console.log('─'.repeat(60));
		console.log('Virtual device restarted successfully!\n');
		console.log(`  Container: ${instance.name}`);
		console.log(`  SSH Port:  ${instance.sshPort}`);
		console.log(`  Status:    ${instance.status}`);

		console.log('\nTo connect via SSH (once booted):');
		console.log(`  ssh root@localhost -p ${instance.sshPort}`);

		if (options.detached) {
			this.printDetachedInfo(instance.name);
		} else {
			await this.attachInteractive(instance.name, workingCopyPath ?? undefined);
		}
	}

	/**
	 * Start a new VM from an image file.
	 */
	private async startNewVm(options: {
		image: string;
		'data-size': string;
		detached: boolean;
		memory: number;
		cpus: number;
	}) {
		const path = await import('path');
		const fs = await import('fs/promises');

		// Resolve image path to absolute
		const imagePath = path.resolve(options.image);

		// Import virtual-device utilities
		const {
			validateImageExists,
			validateImageFormat,
			detectFlasherImage,
			extractFlasherImage,
			createWorkingCopy,
			expandImage,
			buildDockerImage,
			launchContainer,
			detectArchitecture,
			getCacheDirectory,
			removeWorkingCopy,
		} = await import('../../utils/virtual-device');

		console.log('Starting virtual device...\n');

		// Step 1: Validate image exists
		console.log('[1/6] Validating image...');
		const exists = await validateImageExists(imagePath);
		if (!exists) {
			throw new ExpectedError(`Image file not found: ${imagePath}`);
		}

		// Step 2: Validate image format (must be raw/uncompressed)
		try {
			await validateImageFormat(imagePath);
		} catch (err) {
			throw new ExpectedError(err instanceof Error ? err.message : String(err));
		}
		console.log('  Image format: OK (raw)');

		// Detect host architecture
		const hostArch = detectArchitecture();
		console.log(`  Host architecture: ${hostArch}`);

		// Step 2: Build Docker image (needed for flasher extraction and expansion)
		console.log('\n[2/6] Building Docker image...');
		await buildDockerImage();
		console.log('  Docker image ready.');

		// Step 3: Check for flasher image and extract if needed
		console.log('\n[3/6] Checking for flasher image...');
		let sourceImagePath = imagePath;
		let extractedPath: string | undefined;

		const flasherResult = await detectFlasherImage(imagePath);
		if (flasherResult.isFlasher && flasherResult.innerImageName) {
			console.log(
				`  Detected flasher image with inner image: ${flasherResult.innerImageName}`,
			);
			console.log('  Extracting inner raw image...');

			const cacheDir = await getCacheDirectory();
			const extraction = await extractFlasherImage({
				flasherPath: imagePath,
				destDir: cacheDir,
			});
			extractedPath = extraction.extractedPath;
			sourceImagePath = extractedPath;
			console.log('  Extraction complete.');
		} else {
			console.log('  Not a flasher image, using directly.');
		}

		// Step 4: Create working copy
		console.log('\n[4/6] Creating working copy...');
		let workingCopyPath: string;
		if (extractedPath) {
			// For extracted flasher images, rename instead of copy to save disk space.
			// The extracted file is already temporary, so we avoid needing 2x disk space.
			const cacheDir = await getCacheDirectory();
			const timestamp = Date.now();
			const originalName = path.basename(extractedPath);
			workingCopyPath = path.join(
				cacheDir,
				`virt-working-${timestamp}-${originalName}`,
			);
			await fs.rename(extractedPath, workingCopyPath);
			console.log(`  Working copy created at: ${workingCopyPath}`);
		} else {
			workingCopyPath = await createWorkingCopy(sourceImagePath);
			console.log(`  Working copy created at: ${workingCopyPath}`);
		}

		// Step 5: Expand image for data partition
		console.log('\n[5/6] Expanding image...');
		try {
			const expandResult = await expandImage({
				imagePath: workingCopyPath,
				targetSize: options['data-size'],
			});
			console.log(`  ${expandResult.message}`);
		} catch (err) {
			// Clean up working copy on error
			await removeWorkingCopy(workingCopyPath);
			throw new ExpectedError(
				`Failed to expand image: ${err instanceof Error ? err.message : String(err)}`,
			);
		}

		// Step 6: Launch container
		// In attached mode, launch with interactive=true for bidirectional console
		const isInteractive = !options.detached;
		console.log('\n[6/6] Launching virtual device...');
		let instance: Awaited<ReturnType<typeof launchContainer>>['instance'];
		let accelerator: Awaited<ReturnType<typeof launchContainer>>['accelerator'];

		try {
			const result = await launchContainer({
				osImagePath: workingCopyPath,
				memory: options.memory,
				cpus: options.cpus,
				interactive: isInteractive,
			});

			instance = result.instance;
			accelerator = result.accelerator;
		} catch (err) {
			// Clean up working copy on error
			await removeWorkingCopy(workingCopyPath);
			throw new ExpectedError(
				`Failed to launch container: ${err instanceof Error ? err.message : String(err)}`,
			);
		}

		// Print success info
		console.log('\n' + '─'.repeat(60));
		console.log('Virtual device started successfully!\n');
		console.log(`  Container:   ${instance.name}`);
		console.log(`  SSH Port:    ${instance.sshPort}`);
		console.log(`  Status:      ${instance.status}`);
		console.log(`  Accelerator: ${accelerator.description}`);

		// Show warning if there's a permission issue or other accelerator warning
		if (accelerator.warning) {
			console.log(`\n  Warning: ${accelerator.warning}`);
		}

		console.log('\nTo connect via SSH (once booted):');
		console.log(`  ssh root@localhost -p ${instance.sshPort}`);

		if (options.detached) {
			this.printDetachedInfo(instance.name);
		} else {
			await this.attachInteractive(instance.name, workingCopyPath);
		}
	}

	/**
	 * Print info for detached mode and exit.
	 */
	private printDetachedInfo(containerName: string) {
		console.log('\nTo view logs:');
		console.log(`  docker logs -f ${containerName}`);

		console.log('\nTo attach to the console:');
		console.log(`  docker attach ${containerName}`);
		console.log('  (Ctrl+P, Ctrl+Q to detach)');

		console.log('\nTo stop (preserves VM for restart):');
		console.log(`  balena virt stop ${containerName}`);

		console.log('\nTo remove and clean up:');
		console.log(`  balena virt rm ${containerName}`);
		console.log('─'.repeat(60));
	}

	/**
	 * Attach to container interactively with Ctrl+C handling.
	 */
	private async attachInteractive(
		containerName: string,
		_workingCopyPath?: string,
	) {
		console.log('\nKeyboard controls:');
		console.log(
			'  Ctrl+C         - Stop the virtual device (preserves for restart)',
		);
		console.log('  Ctrl+P, Ctrl+Q - Detach (VM keeps running)');
		console.log('  Ctrl+A, C      - Access QEMU monitor');
		console.log('─'.repeat(60) + '\n');

		const { attachToContainer, stopContainer } = await import(
			'../../utils/virtual-device'
		);

		const instanceId = extractInstanceId(containerName);

		try {
			await attachToContainer({
				containerNameOrId: containerName,
				onStop: async () => {
					// Stop container on Ctrl+C (preserve for restart)
					await stopContainer(containerName);
					console.log(`\nVirtual device stopped: ${containerName}`);
					console.log(`To restart: balena virt start ${instanceId}`);
					console.log(`To remove and clean up: balena virt rm ${instanceId}`);
				},
				onDetach: () => {
					// User detached with Ctrl+P,Ctrl+Q - VM keeps running
					console.log('\nVM is still running in the background.');
					console.log(`To reattach: docker attach ${containerName}`);
					console.log(`To stop: balena virt stop ${instanceId}`);
					console.log(`To remove: balena virt rm ${instanceId}`);
				},
			});
		} catch (err) {
			// Stop on error (don't remove - let user investigate)
			await stopContainer(containerName).catch(() => {
				// Ignore stop errors
			});
			throw new ExpectedError(
				`Error attaching to console: ${err instanceof Error ? err.message : String(err)}`,
			);
		}
	}
}
