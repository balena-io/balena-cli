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
import { promises as fs } from 'fs';
import { execFile } from 'child_process';
import * as path from 'path';
import * as tmp from 'tmp';
import { promisify } from 'util';
import * as Dockerode from 'dockerode';

import { cleanOutput, runCommand, skipIfNoDocker } from '../../helpers';
import { detectArchitecture } from '../../../build/utils/virtual-device/arch';
import {
	resolveVersion,
	getStream,
	getImagePath,
	isImageCached,
} from '../../../build/utils/image-manager';
import { getBalenaSdk } from '../../../build/utils/lazy';

/**
 * Get Docker container logs for debugging boot failures.
 */
async function getContainerLogs(containerId: string): Promise<string> {
	const docker = new Dockerode();
	const container = docker.getContainer(containerId);
	const logs = await container.logs({
		stdout: true,
		stderr: true,
		tail: 200,
	});
	// Docker logs have 8-byte header per line, strip them
	return logs
		.toString('utf-8')
		.split('\n')
		.map((line: string) => (line.length > 8 ? line.slice(8) : line))
		.join('\n');
}

tmp.setGracefulCleanup();
const execFileAsync = promisify(execFile);

/**
 * Download a disk-image type balenaOS image using the CLI's image-manager.
 *
 * Leverages the built-in download + cache infrastructure so repeated runs
 * skip the download entirely. Returns the path to the cached image file.
 *
 * @param deviceType - Device type (e.g., 'generic-amd64', 'generic-aarch64')
 * @param version - OS version, semver range, or 'latest'
 * @returns Path to the cached disk-image
 */
async function downloadDiskImage(
	deviceType: string,
	version: string,
): Promise<string> {
	// Only request type=disk-image explicitly when the device type defaults
	// to installation-media. Device types that already default to disk-image
	// (e.g. generic-aarch64) don't have a separate 'raw' variant on the API.
	const balena = getBalenaSdk();
	const dtManifest =
		await balena.models.config.getDeviceTypeManifestBySlug(deviceType);
	const defaultIsInstallationMedia = /^(resin|balena)-image-flasher\b/.test(
		dtManifest.yocto.deployArtifact,
	);
	const type = defaultIsInstallationMedia ? ('disk-image' as const) : undefined;

	const resolved = await resolveVersion(deviceType, version);

	if (!(await isImageCached(deviceType, resolved, type))) {
		console.log(`Downloading ${deviceType} v${resolved} (disk-image)...`);
		const stream = await getStream(deviceType, resolved, {
			type,
			developmentMode: true,
		});
		// Consume the stream fully so the cache write completes
		await new Promise<void>((resolve, reject) => {
			stream.on('end', resolve);
			stream.on('error', reject);
			stream.resume();
		});
	} else {
		console.log(`Using cached ${deviceType} v${resolved} (disk-image)`);
	}

	return getImagePath(deviceType, resolved, type);
}

// Timeouts for various operations
const IMAGE_DOWNLOAD_TIMEOUT = 10 * 60 * 1000; // 10 min
const VM_BOOT_TIMEOUT = 3 * 60 * 1000; // 3 min
const SSH_CONNECT_TIMEOUT = 5 * 60 * 1000; // 5 min (emulated VMs are slow)
const SSH_RETRY_INTERVAL = 5000; // 5 sec

describe('virtual-device E2E', function () {
	this.slow(60000);
	this.timeout(IMAGE_DOWNLOAD_TIMEOUT + VM_BOOT_TIMEOUT + SSH_CONNECT_TIMEOUT);

	let imagePath: string;
	let configPath: string;
	let deviceType: string;
	let sshPort: number | null = null;
	let containerName: string | null = null;

	before(async function () {
		// Skip if Docker not available
		skipIfNoDocker(this, 'virtual-device E2E tests');

		// Use workspace disk for the balena cache directory in CI.
		// The default BALENARC_DATA_DIRECTORY from config-tests.ts uses tmp.dirSync()
		// which creates a tmpfs mount in RAM. On x86 CI runners with 8-12GB RAM,
		// this causes OOM when downloading ~2.5GB OS images.
		let tempDir: string | undefined;
		if (process.env.RUNNER_TEMP) {
			const dataDir = path.join(process.env.RUNNER_TEMP, '.balena-test-data');
			await fs.mkdir(dataDir, { recursive: true });
			process.env.BALENARC_DATA_DIRECTORY = dataDir;
			tempDir = dataDir;
			console.log(`E2E test: using workspace data dir: ${dataDir}`);
		}

		configPath = tmp.tmpNameSync({ tmpdir: tempDir }) + '.json';

		// Detect architecture and select device type
		// Allow override via TEST_DEVICE_TYPE for testing cross-arch extraction
		const arch = detectArchitecture();
		deviceType =
			process.env.TEST_DEVICE_TYPE ??
			(arch === 'arm64' ? 'generic-aarch64' : 'generic-amd64');
		console.log(`E2E test: using ${deviceType} on ${arch} host`);
		if (process.env.TEST_DEVICE_TYPE) {
			console.log(
				'  (device type overridden via TEST_DEVICE_TYPE environment variable)',
			);
		}
	});

	after(async function () {
		// Always clean up VMs (ignore errors if none running)
		await runCommand('virtual-device rm --all').catch((_e) => {
			// Intentionally ignore - cleanup best-effort
		});

		// Clean up temp config file (image is in the cache, leave it)
		await fs.unlink(configPath).catch((_e) => {
			// Intentionally ignore - cleanup best-effort
		});
	});

	afterEach(async function () {
		// Print container logs on any test failure for debugging
		if (this.currentTest?.state === 'failed' && containerName) {
			console.error(`\n=== Container logs for ${containerName} ===`);
			try {
				const logs = await getContainerLogs(containerName);
				console.error(logs);
			} catch (logErr) {
				console.error('Failed to get container logs:', logErr);
			}
			console.error('=== End container logs ===\n');
		}
	});

	describe('image download', function () {
		this.timeout(IMAGE_DOWNLOAD_TIMEOUT);

		it('downloads balenaOS disk-image for host architecture', async function () {
			imagePath = await downloadDiskImage(deviceType, 'latest');

			// Verify image was downloaded and has reasonable size (>100MB)
			const stats = await fs.stat(imagePath);
			console.log(
				`Image: ${imagePath} (${(stats.size / (1024 * 1024)).toFixed(0)} MB)`,
			);
			expect(stats.size).to.be.greaterThan(100 * 1024 * 1024);
		});
	});

	describe('virtual device boot', function () {
		this.timeout(VM_BOOT_TIMEOUT);

		it('starts virtual device in detached mode', async function () {
			const { out, err } = await runCommand(
				`virtual-device start --image ${imagePath} --detached`,
			);

			// Extract container name from start command output
			const containerMatch = out.join('\n').match(/Container:\s+(\S+)/);
			if (containerMatch) {
				containerName = containerMatch[1];
			}

			// Get SSH port from list command to verify it started
			const { out: listOut } = await runCommand('virtual-device list --json');

			interface VirtInstance {
				status: string;
				containerId?: string;
				ssh_port?: number;
				name?: string;
			}
			const instances: VirtInstance[] = JSON.parse(
				cleanOutput(listOut, true).join(''),
			);
			const running = [...instances]
				.reverse()
				.find((i) => i.status === 'running');

			if (!running) {
				console.error('Start command stderr:', err.join('\n'));
				const anyInstance = instances[instances.length - 1];
				// Fallback: get container name from list if not captured from start output
				containerName = containerName ?? anyInstance?.name ?? null;
				if (anyInstance) {
					console.error(`Container status: ${anyInstance.status}`);
				} else {
					console.error('No container found - start may have failed early');
				}
			}
			expect(running, 'Should have a running instance').to.exist;
			sshPort = running!.ssh_port ?? null;
			expect(sshPort).to.be.a('number');
			console.log(`VM started, SSH available on port ${sshPort}`);
		});
	});

	describe('SSH connection', function () {
		this.timeout(SSH_CONNECT_TIMEOUT);

		it('connects via SSH after boot completes', async function () {
			if (sshPort == null) {
				this.skip();
			}

			const trySSH = async (): Promise<boolean> => {
				try {
					const { stdout } = await execFileAsync(
						'ssh',
						[
							'-o',
							'StrictHostKeyChecking=no',
							'-o',
							'UserKnownHostsFile=/dev/null',
							'-o',
							'ConnectTimeout=5',
							'-o',
							'BatchMode=yes',
							'-p',
							String(sshPort),
							'root@localhost',
							'echo SSH_OK',
						],
						{ timeout: 10000 },
					);
					return stdout.includes('SSH_OK');
				} catch {
					return false;
				}
			};

			const startTime = Date.now();
			let connected = false;
			let attempts = 0;

			while (Date.now() - startTime < SSH_CONNECT_TIMEOUT - 10000) {
				attempts++;
				connected = await trySSH();
				if (connected) {
					console.log(`SSH connected after ${attempts} attempts`);
					break;
				}
				await new Promise<void>((resolve) =>
					setTimeout(() => {
						resolve();
					}, SSH_RETRY_INTERVAL),
				);
			}

			expect(connected, 'SSH should connect within timeout').to.be.true;
		});
	});

	describe('cleanup', function () {
		it('removes virtual device', async function () {
			await runCommand('virtual-device rm --all');

			// Verify no instances remain
			const { out } = await runCommand('virtual-device list --json');
			const instances = JSON.parse(cleanOutput(out, true).join(''));
			expect(instances).to.deep.equal([]);
		});
	});
});
