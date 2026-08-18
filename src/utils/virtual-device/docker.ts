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

import type * as Dockerode from 'dockerode';
import * as path from 'path';
import * as os from 'os';
import { promises as fs, constants as fsConstants } from 'fs';

import {
	CONTAINER_PREFIX,
	DEFAULT_SSH_BASE_PORT,
	DOCKER_IMAGE_NAME,
	type ContainerStatus,
	type DockerBuildOptions,
	type VirtInstance,
} from './types';
import { removeWorkingCopy } from './image';

/** Default VM memory allocation in MB. */
export const DEFAULT_MEMORY = 2048;

/** Default VM CPU core count. */
export const DEFAULT_CPUS = 4;

/** Guest architecture for QEMU - determines which qemu-system-* binary to use. */
export type GuestArch = 'x86_64' | 'aarch64';

/**
 * Detect the guest architecture from a balenaOS image.
 *
 * Checks for ARM64 EFI bootloader signature (BOOTAA64) in the image.
 * If found, the image is aarch64; otherwise, it's x86_64.
 *
 * @param imagePath - Path to the OS image file
 * @returns Detected guest architecture
 */
export async function detectGuestArch(imagePath: string): Promise<GuestArch> {
	// ARM64 images contain "BOOTAA64" in the EFI System Partition,
	// which is typically within the first few MB of the image.
	const SCAN_SIZE = 10 * 1024 * 1024; // 10MB
	const needle = Buffer.from('BOOTAA64');
	const handle = await fs.open(imagePath, 'r');
	try {
		const stats = await handle.stat();
		const readSize = Math.min(SCAN_SIZE, stats.size);
		const buffer = Buffer.alloc(readSize);
		await handle.read(buffer, 0, readSize, 0);

		if (buffer.includes(needle)) {
			return 'aarch64';
		}
		return 'x86_64';
	} finally {
		await handle.close();
	}
}

/** Path to the assets directory containing Dockerfile and entrypoint script. */
const ASSETS_DIR = path.join(__dirname, 'assets');

/**
 * Get a Docker client instance.
 * Uses the default Docker socket or DOCKER_HOST environment variable.
 */
export async function getDockerClient(): Promise<Dockerode> {
	const { getDocker } = await import('../docker');
	return getDocker({});
}

/**
 * Check if the balena-qemu-runner Docker image exists locally.
 *
 * @param docker - Docker client instance
 * @param imageName - Name of the image to check (defaults to DOCKER_IMAGE_NAME)
 * @returns true if the image exists locally
 */
export async function imageExists(
	docker: Dockerode,
	imageName: string = DOCKER_IMAGE_NAME,
): Promise<boolean> {
	try {
		await docker.getImage(imageName).inspect();
		return true;
	} catch (err) {
		if ((err as any).statusCode === 404) {
			return false;
		}
		throw err;
	}
}

/**
 * Build the balena-qemu-runner Docker image from Dockerfile.
 *
 * The image contains QEMU system tools and OVMF/EFI firmware for UEFI boot.
 * Does NOT include balena-cli - config injection runs on host.
 *
 * Always runs docker build to ensure Dockerfile/entry script changes are picked up.
 * Docker's layer caching makes unchanged builds instant.
 *
 * @param options - Build options
 * @param options.docker - Optional Docker client for testing (dependency injection)
 * @returns The name of the built image
 */
export async function buildDockerImage(
	options: DockerBuildOptions = {},
): Promise<string> {
	const docker = options.docker ?? (await getDockerClient());

	// These files are small (~2KB total) so buffering is fine.
	// Streaming would add complexity for no real benefit.
	// If copying this pattern for larger files, consider using fs.createReadStream().pipe()
	const dockerfileContent = await fs.readFile(
		path.join(ASSETS_DIR, 'Dockerfile'),
		'utf8',
	);
	const entryScriptContent = await fs.readFile(
		path.join(ASSETS_DIR, 'entrypoint.sh'),
		'utf8',
	);

	// Build the image using tar stream
	const tar = await import('tar-stream');

	const pack = tar.pack();

	// Add Dockerfile
	pack.entry({ name: 'Dockerfile' }, dockerfileContent);
	// Add entry.sh
	pack.entry({ name: 'entry.sh', mode: 0o755 }, entryScriptContent);
	pack.finalize();

	// Build the image
	const stream = await docker.buildImage(pack, {
		t: DOCKER_IMAGE_NAME,
		// Build for current platform
		platform: `linux/${os.arch() === 'arm64' ? 'arm64' : 'amd64'}`,
	});

	// Wait for build to complete and collect output
	// Pattern from balena-preload: https://github.com/balena-io-modules/balena-preload/blob/2ef8e0ae/lib/preload.ts#L343
	// followProgress buffers all events (see docker-toolbelt's followProgressUnbuffered for alternative).
	// Build output is bounded by Dockerfile steps (~50KB max), so buffering is acceptable here.
	await new Promise<void>((resolve, reject) => {
		// Type definitions mismatch: dockerode returns NodeJS.ReadableStream,
		// but docker-modem's followProgress expects stream.Stream. At runtime
		// they're the same object, but the type definitions are inconsistent.
		docker.modem.followProgress(
			stream as unknown as import('stream').Stream,
			(error, output) => {
				// onFinished - check for errors in the final output
				if (!error && output?.length) {
					const lastOutput = output.at(-1) as { error?: string };
					if (lastOutput.error) {
						error = new Error(lastOutput.error);
					}
				}
				if (error) {
					reject(error);
				} else {
					resolve();
				}
			},
			(event) => {
				// onProgress - log build output for debugging
				// event.stream is Docker's build output (string, not a stream object)
				// Use process.stderr.write to avoid extra newlines from console.error
				if (process.env.DEBUG && event.stream) {
					process.stderr.write(event.stream);
				}
			},
		);
	});

	return DOCKER_IMAGE_NAME;
}

/** Map of Docker states to our ContainerStatus type. */
const DOCKER_STATE_MAP: Record<string, ContainerStatus> = {
	running: 'running',
	exited: 'exited',
	paused: 'paused',
	created: 'created',
};

/**
 * Map Docker's container state to our ContainerStatus type.
 * Docker returns states like "running", "exited", "paused", "created", "restarting", etc.
 * Transitional states (like "restarting") are treated as "running".
 */
function mapContainerStatus(dockerState: string): ContainerStatus {
	return DOCKER_STATE_MAP[dockerState.toLowerCase()] ?? 'running';
}

const CONTAINER_IMAGE_PATH = '/tmp/balena-os.img';

/**
 * Extract the working copy path from container bind mounts.
 * Format: "/path/to/working-copy:/tmp/balena-os.img:rw"
 */
function extractWorkingCopyPath(binds: string[]): string | null {
	for (const bind of binds) {
		if (bind.includes(CONTAINER_IMAGE_PATH)) {
			return bind.split(':', 1)[0];
		}
	}
	return null;
}

/**
 * Extract the SSH host port from a container's port bindings.
 * Looks for the mapping of internal port 22222/tcp to a host port.
 *
 * @param portBindings - Port bindings from container inspection
 * @returns The host SSH port, or 0 if not found
 */
function extractSshPort(ports: Dockerode.Port[]): number {
	const ssh = ports.find(
		(p) => p.PrivatePort === DEFAULT_SSH_BASE_PORT && p.Type === 'tcp',
	);
	return ssh?.PublicPort ?? 0;
}

/**
 * List all virtual device containers.
 *
 * Returns containers matching the balenaos-vm-* naming pattern with their
 * SSH port mappings, status, and creation time.
 *
 * @param docker - Docker client instance (optional, will create one if not provided)
 * @returns Array of VirtInstance objects
 */
export async function listContainers(
	docker?: Dockerode,
): Promise<VirtInstance[]> {
	const client = docker ?? (await getDockerClient());

	// List containers with name filter (includes both running and stopped)
	const containers = await client.listContainers({
		all: true,
		filters: {
			name: [CONTAINER_PREFIX],
		},
	});

	const instances: VirtInstance[] = [];

	for (const c of containers) {
		const name = c.Names?.[0]?.replace(/^\//, '') ?? '';
		if (!name.startsWith(CONTAINER_PREFIX)) {
			continue;
		}

		instances.push({
			name,
			containerId: c.Id,
			status: mapContainerStatus(c.State),
			sshPort: extractSshPort(c.Ports),
			created: new Date(c.Created * 1000).toISOString(),
		});
	}

	// Sort by name for consistent ordering
	instances.sort((a, b) => a.name.localeCompare(b.name));

	return instances;
}

/**
 * Options for launching a container.
 */
export interface LaunchContainerOptions {
	/** Path to the configured OS image */
	osImagePath: string;
	/** Host port for SSH forwarding (defaults to auto-detect next available) */
	sshPort?: number;
	/** Memory allocation in MB (default: 2048) */
	memory?: number;
	/** Number of CPU cores (default: 4) */
	cpus?: number;
	/** Enable interactive mode with TTY and stdin attached (default: false) */
	interactive?: boolean;
}

/**
 * Result of launching a container.
 */
export interface LaunchContainerResult {
	instance: VirtInstance;
	accelerator: AcceleratorInfo;
}

/**
 * Find the next available SSH port starting from the base port.
 * Checks existing containers to avoid port conflicts.
 *
 * @param docker - Docker client instance
 * @param basePort - Starting port number (default: 22222)
 * @returns Next available port number
 */
function findNextAvailablePort(
	instances: VirtInstance[],
	basePort: number = DEFAULT_SSH_BASE_PORT,
): number {
	const usedPorts = new Set(
		instances.filter((i) => i.sshPort > 0).map((i) => i.sshPort),
	);
	let port = basePort;
	while (usedPorts.has(port)) {
		port++;
	}
	return port;
}

function generateContainerName(instances: VirtInstance[]): string {
	const usedNumbers = new Set<number>();
	for (const instance of instances) {
		const match = instance.name.match(/^balenaos-vm-(\d+)/);
		if (match) {
			usedNumbers.add(parseInt(match[1], 10));
		}
	}
	let num = 1;
	while (usedNumbers.has(num)) {
		num++;
	}
	const timestamp = Math.floor(Date.now() / 1000);
	return `${CONTAINER_PREFIX}${num}-${timestamp}`;
}

/**
 * Result of accelerator detection.
 */
export interface AcceleratorInfo {
	/** The accelerator string to pass to QEMU (e.g., "kvm:tcg" or "tcg") */
	accel: string;
	/** Whether KVM is available and will be used */
	kvmAvailable: boolean;
	/** Optional warning message (e.g., permission issues) */
	warning?: string;
	/** Human-readable description of what accelerator is being used */
	description: string;
}

/**
 * Detect available QEMU accelerators on the host.
 *
 * Checks platform and permissions to determine the best accelerator strategy:
 * - Linux: Check /dev/kvm for read+write access
 * - macOS: HVF not available from Docker containers, use TCG
 * - Windows: WHPX rarely functional in containers, use TCG
 *
 * Returns an accelerator string with fallback chain (e.g., "kvm:tcg").
 * QEMU will try accelerators in order and use the first available one.
 */
async function detectAccelerators(): Promise<AcceleratorInfo> {
	const platform = os.platform();

	// macOS: HVF is not accessible from Docker containers
	// Docker Desktop for Mac uses its own virtualization layer
	if (platform === 'darwin') {
		return {
			accel: 'tcg',
			kvmAvailable: false,
			description: 'software emulation (TCG)',
		};
	}

	// Windows: WHPX is rarely functional and not typically available in containers
	if (platform === 'win32') {
		return {
			accel: 'tcg',
			kvmAvailable: false,
			description: 'software emulation (TCG)',
		};
	}

	// Linux: Check for KVM availability
	if (platform === 'linux') {
		const kvmPath = '/dev/kvm';

		try {
			// Check if /dev/kvm exists first
			await fs.access(kvmPath, fsConstants.F_OK);

			// Check for read+write access (required for KVM)
			try {
				// eslint-disable-next-line no-bitwise
				await fs.access(kvmPath, fsConstants.R_OK | fsConstants.W_OK);

				// KVM is available and accessible
				return {
					accel: 'kvm:tcg',
					kvmAvailable: true,
					description: 'KVM hardware acceleration with TCG fallback',
				};
			} catch {
				// /dev/kvm exists but not accessible - permission issue
				return {
					accel: 'tcg',
					kvmAvailable: false,
					warning:
						'KVM device exists but is not accessible. ' +
						'You may need to add your user to the "kvm" group: sudo usermod -aG kvm $USER',
					description: 'software emulation (TCG)',
				};
			}
		} catch {
			// /dev/kvm doesn't exist - KVM not available
			return {
				accel: 'tcg',
				kvmAvailable: false,
				description: 'software emulation (TCG)',
			};
		}
	}

	// Unknown platform: fall back to TCG
	return {
		accel: 'tcg',
		kvmAvailable: false,
		description: 'software emulation (TCG)',
	};
}

/**
 * Launch a new virtual device container.
 *
 * Creates and starts a Docker container running the balena-qemu-runner image
 * with the specified OS image mounted.
 *
 * @param options - Launch options
 * @returns The created container instance and KVM availability info
 */
export async function launchContainer(
	options: LaunchContainerOptions,
): Promise<LaunchContainerResult> {
	const docker = await getDockerClient();

	// Ensure the Docker image exists
	if (!(await imageExists(docker))) {
		throw new Error(
			`Docker image '${DOCKER_IMAGE_NAME}' not found. Run 'balena virtual-device start' to build it.`,
		);
	}

	// Verify OS image exists
	const { exists } = await import('../which');
	if (!(await exists(options.osImagePath))) {
		throw new Error(`OS image not found at: ${options.osImagePath}`);
	}

	// Get port and container name from a single listContainers call
	const existingInstances = await listContainers(docker);
	const sshPort = options.sshPort ?? findNextAvailablePort(existingInstances);
	const containerName = generateContainerName(existingInstances);

	// Detect available accelerators for QEMU
	const accelerator = await detectAccelerators();

	// Detect guest architecture from the image
	const guestArch = await detectGuestArch(options.osImagePath);

	// Build environment variables
	const env = [
		`MEMORY=${options.memory ?? DEFAULT_MEMORY}`,
		`CPUS=${options.cpus ?? DEFAULT_CPUS}`,
		`QEMU_ACCEL=${accelerator.accel}`,
		`GUEST_ARCH=${guestArch}`,
	];

	// Create container configuration
	const createOptions: Dockerode.ContainerCreateOptions = {
		name: containerName,
		Image: DOCKER_IMAGE_NAME,
		Env: env,
		HostConfig: {
			Privileged: true,
			PortBindings: {
				'22222/tcp': [{ HostPort: String(sshPort) }],
			},
			Binds: [`${options.osImagePath}:${CONTAINER_IMAGE_PATH}:rw`],
			// Only bind /dev/kvm if KVM is available and accessible
			Devices: accelerator.kvmAvailable
				? [
						{
							PathOnHost: '/dev/kvm',
							PathInContainer: '/dev/kvm',
							CgroupPermissions: 'rwm',
						},
					]
				: undefined,
		},
		ExposedPorts: {
			'22222/tcp': {},
		},
		// Interactive mode: enable TTY and stdin for bidirectional console
		...(options.interactive && {
			Tty: true,
			OpenStdin: true,
			AttachStdin: true,
			AttachStdout: true,
			AttachStderr: true,
		}),
	};

	// Create and start the container
	const container = await docker.createContainer(createOptions);
	await container.start();

	// Get container info for the result
	const inspection = await container.inspect();

	const instance: VirtInstance = {
		name: containerName,
		containerId: inspection.Id,
		status: 'running',
		sshPort,
		created: inspection.Created,
	};

	return { instance, accelerator };
}

/**
 * Stop a running container by name or ID.
 *
 * @param containerNameOrId - Container name or ID
 * @param docker - Docker client instance (optional)
 * @param timeout - Timeout in seconds before killing (default: 10)
 */
export async function stopContainer(
	containerNameOrId: string,
	docker?: Dockerode,
	timeout = 10,
): Promise<void> {
	const client = docker ?? (await getDockerClient());
	const container = client.getContainer(containerNameOrId);

	try {
		// Check if container exists and is running
		const info = await container.inspect();
		if (info.State.Running) {
			await container.stop({ t: timeout });
		}
	} catch (err) {
		if ((err as any).statusCode !== 404) {
			throw err;
		}
	}
}

/**
 * Start (restart) a stopped container by name or ID.
 *
 * @param containerNameOrId - Container name or ID
 * @param docker - Docker client instance (optional)
 * @returns The started container's VirtInstance info
 * @throws Error if container is not found or is already running
 */
export async function startContainer(
	containerNameOrId: string,
	docker?: Dockerode,
): Promise<VirtInstance> {
	const client = docker ?? (await getDockerClient());
	const container = client.getContainer(containerNameOrId);

	// Check if container exists
	const info = await container.inspect();

	if (info.State.Running) {
		throw new Error(`Container is already running: ${containerNameOrId}`);
	}

	// Start the container
	await container.start();

	// Get updated info
	const inspection = await container.inspect();
	const name = inspection.Name.replace(/^\//, '');

	const portKey = `${DEFAULT_SSH_BASE_PORT}/tcp`;
	const bindings = inspection.NetworkSettings.Ports?.[portKey];
	const sshPort = bindings?.[0]?.HostPort
		? parseInt(bindings[0].HostPort, 10)
		: 0;

	return {
		name,
		containerId: inspection.Id,
		status: 'running',
		sshPort,
		created: inspection.Created,
	};
}

/**
 * Remove a container by name or ID.
 *
 * @param containerNameOrId - Container name or ID
 * @param docker - Docker client instance (optional)
 * @param force - Force removal even if running (default: false)
 */
async function removeContainer(
	containerNameOrId: string,
	docker?: Dockerode,
	force = false,
): Promise<void> {
	const client = docker ?? (await getDockerClient());
	const container = client.getContainer(containerNameOrId);

	try {
		await container.remove({ force, v: true }); // v: true removes associated volumes
	} catch (err) {
		if ((err as any).statusCode !== 404) {
			throw err;
		}
	}
}

/**
 * Stop and remove a container.
 * Convenience function that stops then removes a container.
 *
 * @param containerNameOrId - Container name or ID
 * @param docker - Docker client instance (optional)
 */
async function stopAndRemoveContainer(
	containerNameOrId: string,
	docker?: Dockerode,
): Promise<void> {
	await stopContainer(containerNameOrId, docker);
	await removeContainer(containerNameOrId, docker);
}

/**
 * Result of finding a container by name or ID.
 */
export interface FindContainerResult {
	/** The VirtInstance if found */
	instance: VirtInstance | null;
	/** Path to the working copy image file (extracted from bind mounts) */
	workingCopyPath: string | null;
}

/**
 * Find a container by name or ID (supports partial match on instance number).
 *
 * Searches for containers matching the balenaos-vm-* pattern.
 * Accepts:
 * - Full container name (e.g., "balenaos-vm-1-1234567890")
 * - Instance number (e.g., "1")
 * - Container ID
 *
 * @param identifier - Name, number, or ID of the container to find
 * @param docker - Docker client instance (optional)
 * @returns FindContainerResult with instance and working copy path
 */
export async function findContainer(
	identifier: string,
	docker?: Dockerode,
): Promise<FindContainerResult> {
	const client = docker ?? (await getDockerClient());
	const instances = await listContainers(client);

	// Try to find by exact name, instance number, or container ID
	let found = instances.find((i) => i.name === identifier);

	// Try instance number (e.g., "1" matches "balenaos-vm-1-...")
	if (!found && /^\d+$/.test(identifier)) {
		const pattern = new RegExp(`^${CONTAINER_PREFIX}${identifier}-\\d+$`);
		found = instances.find((i) => pattern.test(i.name));
	}

	// Try container ID (startsWith covers exact match)
	found ??= instances.find((i) => i.containerId.startsWith(identifier));

	if (!found) {
		return { instance: null, workingCopyPath: null };
	}

	// Get working copy path from container inspection
	const container = client.getContainer(found.containerId);
	const inspection = await container.inspect();
	const workingCopyPath = extractWorkingCopyPath(
		inspection.HostConfig?.Binds ?? [],
	);

	return { instance: found, workingCopyPath };
}

/**
 * Stop a container by name or ID and clean up its working copy.
 *
 * This function:
 * 1. Finds the container by name, number, or ID
 * 2. Stops and removes the container
 * 3. Removes the working copy image file from the cache directory
 *
 * @param identifier - Name, number, or ID of the container to stop
 * @param docker - Docker client instance (optional)
 * @returns Object with stopped container name and whether working copy was cleaned
 * @throws Error if container is not found
 */
export async function stopContainerWithCleanup(
	identifier: string,
): Promise<{ name: string; workingCopyRemoved: boolean }> {
	const client = await getDockerClient();

	// Find the container
	const { instance, workingCopyPath } = await findContainer(identifier, client);

	if (!instance) {
		throw new Error(`Virtual device not found: ${identifier}`);
	}

	// Stop and remove the container
	await stopAndRemoveContainer(instance.containerId, client);

	let workingCopyRemoved = false;
	if (workingCopyPath) {
		try {
			await removeWorkingCopy(workingCopyPath);
			workingCopyRemoved = true;
		} catch (err) {
			console.error(`Warning: failed to remove working copy ${workingCopyPath}: ${err instanceof Error ? err.message : err}`);
		}
	}

	return { name: instance.name, workingCopyRemoved };
}

/**
 * Stop all virtual device containers and clean up their working copies.
 *
 * @returns Object with count of stopped containers and cleaned working copies
 */
export async function stopAllContainersWithCleanup(): Promise<{
	stoppedCount: number;
	cleanedCount: number;
}> {
	const client = await getDockerClient();
	const instances = await listContainers(client);

	const results = await Promise.all(
		instances.map(async (instance) => {
			try {
				// Get working copy path before stopping
				const container = client.getContainer(instance.containerId);
				const inspection = await container.inspect();
				const workingCopyPath = extractWorkingCopyPath(
					inspection.HostConfig?.Binds ?? [],
				);

				// Stop and remove container
				if (instance.status === 'running') {
					await stopContainer(instance.containerId, client);
				}
				await removeContainer(instance.containerId, client);

				if (workingCopyPath) {
					try {
						await removeWorkingCopy(workingCopyPath);
						return { stopped: true, cleaned: true };
					} catch (err) {
						console.error(`Warning: failed to remove working copy for ${instance.name}: ${err instanceof Error ? err.message : err}`);
						return { stopped: true, cleaned: false };
					}
				}
				return { stopped: true, cleaned: false };
			} catch (err) {
				console.error(`Failed to clean up ${instance.name}: ${err instanceof Error ? err.message : err}`);
				return { stopped: false, cleaned: false };
			}
		}),
	);

	const stoppedCount = results.filter((r) => r.stopped).length;
	const cleanedCount = results.filter((r) => r.cleaned).length;

	return { stoppedCount, cleanedCount };
}

/**
 * Options for streaming container logs (non-interactive).
 */
export interface StreamContainerLogsOptions {
	/** Container name or ID */
	containerNameOrId: string;
	/** Callback when user stops (Ctrl+C) - should stop container */
	onStop?: () => Promise<void>;
	/** Strip ANSI escape sequences from output (default: true) */
	stripAnsi?: boolean;
}

/**
 * Create a writable stream that strips ANSI escape sequences and C0
 * control characters before writing to the target stream. This prevents
 * terminal control codes (clear screen, colors, cursor movement) from
 * affecting the user's terminal in logs mode.
 */
function createAnsiStrippingWriter(
	target: NodeJS.WritableStream,
): NodeJS.WritableStream {
	const stripAnsi = require('strip-ansi') as (str: string) => string;
	const { Writable } = require('stream') as typeof import('stream');

	// Strip C0 control characters that strip-ansi misses (e.g. form feed
	// clears the screen in most terminals). Preserve \n, \r, \t.
	// eslint-disable-next-line no-control-regex
	const controlChars = /[\x00-\x08\x0b\x0c\x0e-\x1a]/g;

	return new Writable({
		write(chunk: Buffer, _encoding, callback) {
			const stripped = stripAnsi(chunk.toString()).replace(controlChars, '');
			target.write(stripped, callback);
		},
	});
}

/**
 * Stream container logs without interactive input.
 *
 * Attaches to stdout/stderr only (no stdin, no TTY).
 * Output is streamed directly to process.stdout/stderr.
 * Handles SIGINT (Ctrl+C) to cleanly stop the container.
 *
 * By default, ANSI escape sequences are stripped to prevent the VM's
 * serial console output from affecting the user's terminal (clearing
 * screen, changing colors, etc.).
 *
 * @param options - Stream options
 * @returns Promise that resolves when container stops or user presses Ctrl+C
 */
export async function streamContainerLogs(
	options: StreamContainerLogsOptions,
): Promise<void> {
	const docker = await getDockerClient();
	const container = docker.getContainer(options.containerNameOrId);
	const stripAnsi = options.stripAnsi ?? true;

	// Verify container exists and is running
	const inspection = await container.inspect();
	if (inspection.State.Status !== 'running') {
		throw new Error(
			`Container is not running: ${options.containerNameOrId} (status: ${inspection.State.Status})`,
		);
	}

	// Attach to container with output streams only (no stdin)
	// Type assertion through unknown needed because Dockerode's types don't reflect
	// that attach() returns a different stream type based on options
	const stream = (await container.attach({
		stream: true,
		stdin: false,
		stdout: true,
		stderr: true,
	})) as unknown as import('stream').Readable;

	// Track state for cleanup
	let stopping = false;

	// Handle SIGINT (Ctrl+C)
	const sigintHandler = async () => {
		if (!stopping) {
			stopping = true;
			console.log('\n\nReceived Ctrl+C, stopping virtual device...');
			stream.destroy();
			if (options.onStop) {
				try {
					await options.onStop();
				} catch (err) {
					console.error('Error during stop:', err instanceof Error ? err.message : err);
				}
			}
		}
	};

	process.on('SIGINT', sigintHandler);

	// Create output streams, optionally with ANSI stripping
	const stdout: NodeJS.WritableStream = stripAnsi
		? createAnsiStrippingWriter(process.stdout)
		: process.stdout;
	const stderr: NodeJS.WritableStream = stripAnsi
		? createAnsiStrippingWriter(process.stderr)
		: process.stderr;

	// Stream container output to stdout/stderr
	return new Promise((resolve, reject) => {
		// Use demuxStream to separate stdout and stderr
		docker.modem.demuxStream(stream, stdout, stderr);

		stream.on('error', (err: Error) => {
			process.removeListener('SIGINT', sigintHandler);
			if (!stopping) {
				reject(err);
			} else {
				resolve();
			}
		});

		stream.on('end', () => {
			process.removeListener('SIGINT', sigintHandler);
			resolve();
		});

		stream.on('close', () => {
			process.removeListener('SIGINT', sigintHandler);
			resolve();
		});
	});
}

/**
 * Options for attaching to a container interactively.
 */
export interface AttachContainerOptions {
	/** Container name or ID */
	containerNameOrId: string;
	/** Callback when user detaches (Ctrl+P,Ctrl+Q) - container keeps running */
	onDetach?: () => void;
	/** Callback when user stops (Ctrl+C) - should stop container */
	onStop?: () => Promise<void>;
}

/**
 * Manages terminal raw mode state for interactive sessions.
 * Each instance tracks its own saved state, avoiding race conditions
 * when multiple attach operations could theoretically overlap.
 */
class TerminalMode {
	private savedMode: boolean | undefined;

	/**
	 * Set terminal to raw mode for interactive input.
	 * Raw mode disables line buffering and echo, sending keys immediately.
	 *
	 * @returns true if raw mode was set, false if stdin is not a TTY
	 */
	setRaw(): boolean {
		if (!process.stdin.isTTY) {
			return false;
		}
		this.savedMode = process.stdin.isRaw;
		process.stdin.setRawMode(true);
		return true;
	}

	/**
	 * Restore terminal to the mode it was in before setRaw() was called.
	 * Safe to call multiple times - subsequent calls are no-ops.
	 */
	restore(): void {
		if (process.stdin.isTTY && this.savedMode !== undefined) {
			process.stdin.setRawMode(this.savedMode);
			this.savedMode = undefined;
		}
	}
}

/**
 * Attach to a running container interactively.
 *
 * Enables bidirectional stdin/stdout streaming to the container.
 * Sets terminal to raw mode for proper key handling.
 *
 * Keyboard controls:
 * - Ctrl+P,Ctrl+Q: Detach (container keeps running)
 * - Ctrl+C: Stop the container
 *
 * @param options - Attach options
 * @returns Promise that resolves when detached or container stops
 */
export async function attachToContainer(
	options: AttachContainerOptions,
): Promise<void> {
	const docker = await getDockerClient();
	const container = docker.getContainer(options.containerNameOrId);

	// Verify container exists and is running
	const inspection = await container.inspect();
	if (inspection.State.Status !== 'running') {
		throw new Error(
			`Container is not running: ${options.containerNameOrId} (status: ${inspection.State.Status})`,
		);
	}

	// Check if container has TTY enabled
	const hasTty = inspection.Config.Tty;

	// Attach to container with bidirectional streams
	const stream = (await container.attach({
		stream: true,
		stdin: true,
		stdout: true,
		stderr: true,
		hijack: true,
	})) as import('stream').Duplex;

	// Track state for cleanup
	let stopping = false;
	let detaching = false;
	let ctrlPPressed = false;

	// Set terminal to raw mode for proper key handling
	// Each attach gets its own TerminalMode instance to avoid shared state issues
	const terminal = new TerminalMode();
	terminal.setRaw();

	// Handler for stdin data - forward to container and detect control sequences
	const stdinHandler = async (data: Buffer) => {
		// Check for Ctrl+C (0x03)
		if (data.length === 1 && data[0] === 0x03) {
			if (!stopping) {
				stopping = true;
				console.log('\n\nReceived Ctrl+C, stopping virtual device...');
				stream.end();
				if (options.onStop) {
					try {
						await options.onStop();
					} catch (err) {
						console.error('Error during stop:', err instanceof Error ? err.message : err);
					}
				}
			}
			return;
		}

		// Check for Docker detach sequence: Ctrl+P (0x10) followed by Ctrl+Q (0x11)
		if (data.length === 1 && data[0] === 0x10) {
			ctrlPPressed = true;
			// Don't forward Ctrl+P yet, wait for Ctrl+Q
			return;
		}

		if (ctrlPPressed && data.length === 1 && data[0] === 0x11) {
			// Detach sequence complete
			detaching = true;
			ctrlPPressed = false;
			console.log('\nDetaching from container (container keeps running)...');
			stream.end();
			return;
		}

		// If we had Ctrl+P but this isn't Ctrl+Q, forward the buffered Ctrl+P first
		if (ctrlPPressed) {
			ctrlPPressed = false;
			stream.write(Buffer.from([0x10]));
		}

		// Forward data to container
		stream.write(data);
	};

	// Set up stdin forwarding
	if (process.stdin.isTTY) {
		process.stdin.resume();
		process.stdin.on('data', stdinHandler);
	}

	// Stream container output to stdout/stderr
	return new Promise((resolve, reject) => {
		// For TTY mode, output goes directly (no demux needed)
		// For non-TTY mode, use demuxStream
		if (hasTty) {
			stream.pipe(process.stdout);
		} else {
			docker.modem.demuxStream(stream, process.stdout, process.stderr);
		}

		stream.on('error', (err: Error) => {
			terminal.restore();
			if (process.stdin.isTTY) {
				process.stdin.removeListener('data', stdinHandler);
				process.stdin.pause();
			}
			if (!stopping && !detaching) {
				reject(err);
			} else {
				resolve();
			}
		});

		stream.on('end', () => {
			terminal.restore();
			if (process.stdin.isTTY) {
				process.stdin.removeListener('data', stdinHandler);
				process.stdin.pause();
			}
			resolve();
		});

		stream.on('close', () => {
			terminal.restore();
			if (process.stdin.isTTY) {
				process.stdin.removeListener('data', stdinHandler);
				process.stdin.pause();
			}
			// If we're detaching, call onDetach (container keeps running)
			if (detaching && options.onDetach) {
				options.onDetach();
			}
			resolve();
		});
	});
}
