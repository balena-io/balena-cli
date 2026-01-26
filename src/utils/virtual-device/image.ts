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

import * as fs from 'fs/promises';
import * as path from 'path';
import type * as Fs from 'fs';
import type { VirtDeviceType } from './types';
import { DOCKER_IMAGE_NAME } from './types';
import { detectArchitecture } from './arch';
import type { HostArchitecture } from './arch';

/**
 * Supported image formats.
 */
export type ImageFormat = 'raw' | 'gzip' | 'zip' | 'unknown';

/**
 * Result of image validation.
 */
export interface ImageValidationResult {
	/** Path to the working copy of the image */
	workingCopyPath: string;
	/** Any warnings generated during validation */
	warnings: string[];
}

/**
 * Magic bytes for common image formats.
 */
const MAGIC_BYTES = {
	gzip: [0x1f, 0x8b],
	zip: [0x50, 0x4b, 0x03, 0x04],
} as const;

/**
 * Get the balena cache directory for storing working copies.
 * Uses the same cache directory as other balena-cli components.
 *
 * @returns Path to the cache directory
 */
export async function getCacheDirectory(): Promise<string> {
	const { getBalenaSdk } = await import('../lazy');
	const balena = getBalenaSdk();
	const cacheDir = await balena.settings.get('cacheDirectory');

	// Ensure the directory exists
	await fs.mkdir(cacheDir, { recursive: true });

	return cacheDir;
}

/**
 * Check if an image file exists and is a regular file.
 *
 * @param imagePath - Path to the image file
 * @returns True if file exists and is a regular file
 */
export async function validateImageExists(imagePath: string): Promise<boolean> {
	try {
		const stat = await fs.stat(imagePath);
		return stat.isFile();
	} catch {
		return false;
	}
}

/**
 * Detect the format of an image file by reading magic bytes.
 *
 * @param imagePath - Path to the image file
 * @returns Detected image format
 * @throws Error if file cannot be read
 */
export async function detectImageFormat(
	imagePath: string,
): Promise<ImageFormat> {
	const handle = await fs.open(imagePath, 'r');
	try {
		const buffer = Buffer.alloc(4);
		await handle.read(buffer, 0, 4, 0);

		// Check for gzip magic bytes (1f 8b)
		if (MAGIC_BYTES.gzip.every((b, i) => buffer[i] === b)) {
			return 'gzip';
		}

		// Check for zip magic bytes (50 4b 03 04)
		if (MAGIC_BYTES.zip.every((b, i) => buffer[i] === b)) {
			return 'zip';
		}

		// Default to raw format (no recognized magic bytes)
		return 'raw';
	} finally {
		await handle.close();
	}
}

/**
 * Validate that an image is in raw (uncompressed) format.
 *
 * @param imagePath - Path to the image file
 * @throws Error if image is compressed
 */
export async function validateImageFormat(imagePath: string): Promise<void> {
	const format = await detectImageFormat(imagePath);

	if (format === 'gzip') {
		throw new Error(
			`Image is gzip compressed. Please decompress it first:\n` +
				`  gunzip "${imagePath}"`,
		);
	}

	if (format === 'zip') {
		throw new Error(
			`Image is zip compressed. Please decompress/extract it first:\n` +
				`  unzip "${imagePath}"`,
		);
	}
}

/**
 * Partition names that indicate a flasher image.
 * Flasher images contain the actual bootable OS in the /opt/ directory
 * of a rootA partition (with 'flash' or legacy 'resin'/'balena' prefix).
 */
const FLASHER_PARTITION_NAMES = ['flash-rootA', 'resin-rootA', 'balena-rootA'];

/**
 * Result of flasher image detection.
 */
export interface FlasherDetectionResult {
	/** Whether the image is a flasher image */
	isFlasher: boolean;
	/** Name of the inner raw image file (if found) */
	innerImageName?: string;
}

/**
 * Detect if an image is a flasher image.
 *
 * Flasher images are self-installing images that contain a nested raw image
 * in the `flash-rootA` partition's `/opt/` directory. The inner image file
 * has a `.balenaos-img` extension.
 *
 * @param imagePath - Path to the image file
 * @returns Detection result with isFlasher flag and inner image name
 */
export async function detectFlasherImage(
	imagePath: string,
): Promise<FlasherDetectionResult> {
	const imagefs = await import('balena-image-fs');
	const partitioninfo = await import('partitioninfo');
	const { withOpenFile, FileDisk } = await import('file-disk');

	return withOpenFile(imagePath, 'r', async (handle) => {
		const fileDisk = new FileDisk(handle, true);
		const partInfo = await partitioninfo.getPartitions(fileDisk);
		const partResult = await imagefs.findPartition(
			fileDisk,
			partInfo,
			FLASHER_PARTITION_NAMES,
		);

		if (!partResult) {
			return { isFlasher: false };
		}

		// Check if /opt contains *.balenaos-img files
		return imagefs.interact<FlasherDetectionResult>(
			imagePath,
			partResult.index,
			async (_fs: typeof Fs): Promise<FlasherDetectionResult> => {
				try {
					const files = await _fs.promises.readdir('/opt');
					const innerImage = files.find((file: string) =>
						file.endsWith('.balenaos-img'),
					);
					if (innerImage) {
						return { isFlasher: true, innerImageName: innerImage };
					}
					return { isFlasher: false };
				} catch {
					return { isFlasher: false };
				}
			},
		);
	});
}

/**
 * Options for Docker-based flasher extraction.
 */
interface ExtractViaDockerOptions {
	/** Path to the flasher image on the host */
	flasherPath: string;
	/** Partition offset in bytes */
	partitionOffset: number;
	/** Path to the inner image within the partition (e.g., "/opt/balena-image.balenaos-img") */
	innerImagePath: string;
	/** Destination path on the host for the extracted image */
	destPath: string;
}

/**
 * Extract inner image from flasher using native e2fsprogs via Docker.
 *
 * This avoids the WASM memory limitations of ext2fs by using native Linux
 * tools (losetup, debugfs) inside the Docker container. The container runs
 * privileged (required for QEMU anyway), so loop devices are available.
 *
 * @param options - Extraction options
 * @throws Error if Docker image not found or extraction fails
 */
async function extractFlasherImageViaDocker(
	options: ExtractViaDockerOptions,
): Promise<void> {
	const { flasherPath, partitionOffset, innerImagePath, destPath } = options;

	const { getDockerClient, imageExists: dockerImageExists } = await import(
		'./docker'
	);

	const docker = await getDockerClient();

	// Ensure the Docker image exists
	if (!(await dockerImageExists(docker))) {
		throw new Error(
			`Docker image '${DOCKER_IMAGE_NAME}' not found. ` +
				`Please ensure the image is built first.`,
		);
	}

	// Get absolute paths
	const absoluteFlasherPath = path.resolve(flasherPath);
	const absoluteDestPath = path.resolve(destPath);
	const destDir = path.dirname(absoluteDestPath);
	const destFilename = path.basename(absoluteDestPath);

	// Ensure destination directory exists
	await fs.mkdir(destDir, { recursive: true });

	// Create container to run extraction
	// Mount flasher image read-only and output directory read-write
	const container = await docker.createContainer({
		Image: DOCKER_IMAGE_NAME,
		Cmd: [
			'/bin/bash',
			'-c',
			`set -e
LOOP=$(losetup -f --show -o ${partitionOffset} /tmp/flasher.img)
debugfs -R "dump ${innerImagePath} /tmp/output/${destFilename}" "$LOOP"
losetup -d "$LOOP"`,
		],
		HostConfig: {
			Privileged: true,
			Binds: [
				`${absoluteFlasherPath}:/tmp/flasher.img:ro`,
				`${destDir}:/tmp/output:rw`,
			],
			AutoRemove: true,
		},
	});

	// Start the container and wait for it to complete
	await container.start();
	const result = await container.wait();

	if (result.StatusCode !== 0) {
		// Try to get logs for error information
		let errorMessage = `Flasher extraction failed with exit code ${result.StatusCode}`;
		try {
			const logStream = await container.logs({
				stdout: true,
				stderr: true,
			});
			const logOutput =
				typeof logStream === 'string' ? logStream : logStream.toString('utf-8');
			if (logOutput.trim()) {
				errorMessage += `: ${logOutput.trim()}`;
			}
		} catch {
			// Ignore log retrieval errors
		}
		throw new Error(errorMessage);
	}

	// Verify the output file was created
	const outputExists = await validateImageExists(absoluteDestPath);
	if (!outputExists) {
		throw new Error(
			`Extraction completed but output file not found: ${absoluteDestPath}`,
		);
	}
}

/**
 * Options for extracting a flasher image.
 */
export interface ExtractFlasherOptions {
	/** Path to the flasher image */
	flasherPath: string;
	/** Directory to extract the inner image to */
	destDir: string;
}

/**
 * Result of flasher image extraction.
 */
export interface ExtractFlasherResult {
	/** Path to the extracted raw image */
	extractedPath: string;
	/** Original name of the inner image */
	innerImageName: string;
}

/**
 * Extract the inner raw image from a flasher image.
 *
 * Flasher images contain the actual bootable OS image in the `flash-rootA`
 * partition's `/opt/` directory. This function extracts that inner image
 * to the specified destination directory using native e2fsprogs tools
 * via Docker to avoid WASM memory limitations with large images.
 *
 * @param options - Extraction options
 * @returns Result with path to extracted image
 * @throws Error if not a flasher image or extraction fails
 */
export async function extractFlasherImage(
	options: ExtractFlasherOptions,
): Promise<ExtractFlasherResult> {
	const { flasherPath, destDir } = options;

	// First, verify this is a flasher image and get the inner image name
	const detection = await detectFlasherImage(flasherPath);
	if (!detection.isFlasher || !detection.innerImageName) {
		throw new Error(`Not a flasher image: ${flasherPath}`);
	}

	const partitioninfo = await import('partitioninfo');
	const imagefs = await import('balena-image-fs');
	const { withOpenFile, FileDisk } = await import('file-disk');

	const innerImageName = detection.innerImageName;
	const extractedPath = path.join(destDir, `extracted-${innerImageName}`);

	// Ensure destination directory exists
	await fs.mkdir(destDir, { recursive: true });

	// Get partition offset for the flasher partition
	const partitionOffset = await withOpenFile(
		flasherPath,
		'r',
		async (handle) => {
			const fileDisk = new FileDisk(handle, true);
			const partInfo = await partitioninfo.getPartitions(fileDisk);
			const partResult = await imagefs.findPartition(
				fileDisk,
				partInfo,
				FLASHER_PARTITION_NAMES,
			);

			if (!partResult) {
				throw new Error('Could not find flasher partition');
			}

			// Find the partition in the list to get its offset
			const partition = partInfo.partitions.find(
				(p: { index: number }) => p.index === partResult.index,
			);
			if (!partition) {
				throw new Error(
					`Could not find partition offset for index ${partResult.index}`,
				);
			}

			return partition.offset;
		},
	);

	// Extract via Docker using native e2fsprogs tools
	// This avoids WASM memory limitations with large (2GB+) images
	await extractFlasherImageViaDocker({
		flasherPath,
		partitionOffset,
		innerImagePath: `/opt/${innerImageName}`,
		destPath: extractedPath,
	});

	return {
		extractedPath,
		innerImageName,
	};
}

/**
 * Check if the image architecture matches the host architecture.
 *
 * @param targetDeviceType - Device type the image is built for
 * @param hostArch - Host machine architecture
 * @returns Warning message if architectures differ, null if they match
 */
export function checkArchitectureMatch(
	targetDeviceType: VirtDeviceType,
	hostArch: HostArchitecture,
): string | null {
	// Map device types to their expected host architecture
	const deviceArchMap: Record<VirtDeviceType, HostArchitecture> = {
		'generic-amd64': 'x64',
		'generic-aarch64': 'arm64',
	};

	const expectedArch = deviceArchMap[targetDeviceType];
	if (hostArch === expectedArch) {
		return null;
	}

	// Cross-architecture emulation warning
	const isX64OnArm = hostArch === 'arm64' && expectedArch === 'x64';
	const isArmOnX64 = hostArch === 'x64' && expectedArch === 'arm64';

	let performanceNote = '';
	if (isX64OnArm || isArmOnX64) {
		performanceNote =
			' Cross-architecture emulation will be significantly slower than native execution.';
	}

	return (
		`Architecture mismatch: image is for ${expectedArch} but host is ${hostArch}.` +
		performanceNote
	);
}

/**
 * Create a working copy of an image in the cache directory.
 * This prevents modification of the original image file.
 *
 * @param sourcePath - Path to the source image
 * @returns Path to the working copy
 * @throws Error if source file doesn't exist or copy fails
 */
export async function createWorkingCopy(sourcePath: string): Promise<string> {
	// Verify source exists
	const exists = await validateImageExists(sourcePath);
	if (!exists) {
		throw new Error(`Image file not found: ${sourcePath}`);
	}

	const cacheDir = await getCacheDirectory();
	const timestamp = Date.now();
	const originalName = path.basename(sourcePath);
	const workingCopyName = `virt-working-${timestamp}-${originalName}`;
	const workingCopyPath = path.join(cacheDir, workingCopyName);

	// Copy the file
	await fs.copyFile(sourcePath, workingCopyPath);

	return workingCopyPath;
}

/**
 * Clean up a working copy after use.
 *
 * @param workingCopyPath - Path to the working copy to remove
 */
export async function removeWorkingCopy(
	workingCopyPath: string,
): Promise<void> {
	try {
		await fs.unlink(workingCopyPath);
	} catch {
		// Ignore errors - file may already be removed
	}
}

/**
 * Validate a user-provided OS image and create a working copy.
 *
 * This function performs the following validations:
 * 1. Checks that the file exists
 * 2. Validates the image is in raw (uncompressed) format
 * 3. Checks for architecture mismatches (returns warning if mismatched)
 * 4. Creates a working copy in the cache directory
 *
 * @param imagePath - Path to the user's OS image
 * @param targetDeviceType - Target device type for the virtual device
 * @returns Validation result with working copy path and any warnings
 * @throws Error if validation fails
 */
export async function validateImage(
	imagePath: string,
	targetDeviceType: VirtDeviceType,
): Promise<ImageValidationResult> {
	const warnings: string[] = [];

	// Check file exists
	const exists = await validateImageExists(imagePath);
	if (!exists) {
		throw new Error(`Image file not found: ${imagePath}`);
	}

	// Validate format (must be raw)
	await validateImageFormat(imagePath);

	// Check architecture match
	// Note: We assume the image is for the same architecture as the host if not specified
	// In a future enhancement, we could detect the architecture from the image itself
	const hostArch = detectArchitecture();
	const archWarning = checkArchitectureMatch(targetDeviceType, hostArch);
	if (archWarning) {
		warnings.push(archWarning);
	}

	// Create working copy
	const workingCopyPath = await createWorkingCopy(imagePath);

	return {
		workingCopyPath,
		warnings,
	};
}

/**
 * Parse a human-readable size string into bytes.
 *
 * Supports suffixes: K/KB, M/MB, G/GB, T/TB (case insensitive)
 *
 * @param sizeStr - Size string (e.g., "8G", "16GB", "2048M")
 * @returns Size in bytes
 * @throws Error if the format is invalid
 */
export function parseSizeString(sizeStr: string): number {
	const match = sizeStr.trim().match(/^(\d+(?:\.\d+)?)\s*([KMGT]B?)?$/i);
	if (!match) {
		throw new Error(
			`Invalid size format: "${sizeStr}". Expected format: <number>[K|M|G|T] (e.g., "8G", "2048M")`,
		);
	}

	const value = parseFloat(match[1]);
	const unit = (match[2] || '').toUpperCase().replace('B', '');

	const multipliers: Record<string, number> = {
		'': 1,
		K: 1024,
		M: 1024 ** 2,
		G: 1024 ** 3,
		T: 1024 ** 4,
	};

	return Math.floor(value * multipliers[unit]);
}

/**
 * Options for expanding an image.
 */
export interface ExpandImageOptions {
	/** Path to the image file to expand */
	imagePath: string;
	/** Target size (e.g., "8G", "16GB") */
	targetSize: string;
}

/**
 * Result of image expansion.
 */
export interface ExpandImageResult {
	/** Whether the image was expanded */
	expanded: boolean;
	/** Final size of the image in bytes */
	finalSize: number;
	/** Message describing what happened */
	message: string;
}

/**
 * Get the current size of a file in bytes.
 *
 * @param filePath - Path to the file
 * @returns File size in bytes
 * @throws Error if file doesn't exist or can't be accessed
 */
export async function getFileSize(filePath: string): Promise<number> {
	const stat = await fs.stat(filePath);
	return stat.size;
}

/**
 * Expand a disk image to a target size using qemu-img via Docker.
 *
 * This function uses the balena-qemu-runner Docker image to run qemu-img,
 * avoiding the need for QEMU tools to be installed on the host.
 *
 * @param options - Expansion options
 * @returns Result indicating whether expansion occurred
 * @throws Error if expansion fails
 */
export async function expandImage(
	options: ExpandImageOptions,
): Promise<ExpandImageResult> {
	const { imagePath, targetSize } = options;

	// Validate image exists
	const exists = await validateImageExists(imagePath);
	if (!exists) {
		throw new Error(`Image file not found: ${imagePath}`);
	}

	// Parse target size
	const targetBytes = parseSizeString(targetSize);

	// Get current size
	const currentSize = await getFileSize(imagePath);

	// Skip if already large enough
	if (currentSize >= targetBytes) {
		return {
			expanded: false,
			finalSize: currentSize,
			message: `Image is already ${formatSize(currentSize)} (>= ${targetSize}), skipping expansion`,
		};
	}

	// Import Docker utilities
	const { getDockerClient, imageExists: dockerImageExists } = await import(
		'./docker'
	);

	const docker = await getDockerClient();

	// Ensure the Docker image exists
	if (!(await dockerImageExists(docker))) {
		throw new Error(
			`Docker image '${DOCKER_IMAGE_NAME}' not found. ` +
				`Build it first with 'balena virtual-device start'.`,
		);
	}

	// Run qemu-img resize inside Docker
	// Mount the image file and resize it in place
	const absolutePath = path.resolve(imagePath);
	const containerImagePath = '/tmp/image.img';

	// Create container to run qemu-img
	const container = await docker.createContainer({
		Image: DOCKER_IMAGE_NAME,
		Cmd: ['qemu-img', 'resize', '-f', 'raw', containerImagePath, targetSize],
		HostConfig: {
			Binds: [`${absolutePath}:${containerImagePath}:rw`],
			AutoRemove: true,
		},
	});

	// Start the container and wait for it to complete
	await container.start();
	const result = await container.wait();

	if (result.StatusCode !== 0) {
		// Try to get logs for error information
		let errorMessage = `qemu-img resize failed with exit code ${result.StatusCode}`;
		try {
			const logStream = await container.logs({
				stdout: true,
				stderr: true,
			});
			const logOutput =
				typeof logStream === 'string' ? logStream : logStream.toString('utf-8');
			if (logOutput.trim()) {
				errorMessage += `: ${logOutput.trim()}`;
			}
		} catch {
			// Ignore log retrieval errors
		}
		throw new Error(errorMessage);
	}

	// Verify the new size
	const newSize = await getFileSize(imagePath);

	return {
		expanded: true,
		finalSize: newSize,
		message: `Image expanded from ${formatSize(currentSize)} to ${formatSize(newSize)}`,
	};
}

/**
 * Format a byte count as a human-readable string.
 *
 * Uses decimal (1000-based) units for UI consistency.
 *
 * @param bytes - Number of bytes
 * @returns Formatted string (e.g., "8.0 GB")
 */
export function formatSize(bytes: number): string {
	const humanize = require('humanize') as typeof import('humanize');
	return humanize.filesize(bytes);
}
