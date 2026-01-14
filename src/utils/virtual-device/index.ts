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

// Re-export all types
export * from './types';

// Re-export utilities
export { detectArchitecture } from './arch';
export type { HostArchitecture } from './arch';
export {
	checkArchitectureMatch,
	createWorkingCopy,
	detectFlasherImage,
	detectImageFormat,
	expandImage,
	extractFlasherImage,
	formatSize,
	getCacheDirectory,
	getFileSize,
	parseSizeString,
	removeWorkingCopy,
	validateImage,
	validateImageExists,
	validateImageFormat,
} from './image';
export type {
	ExpandImageOptions,
	ExpandImageResult,
	ExtractFlasherOptions,
	ExtractFlasherResult,
	FlasherDetectionResult,
	ImageFormat,
	ImageValidationResult,
} from './image';
export {
	attachToContainer,
	buildDockerImage,
	findContainer,
	getDockerClient,
	imageExists,
	launchContainer,
	listContainers,
	startContainer,
	stopAllContainersWithCleanup,
	stopContainer,
	stopContainerWithCleanup,
} from './docker';
export type {
	AttachContainerOptions,
	FindContainerResult,
	LaunchContainerOptions,
	LaunchContainerResult,
} from './docker';

// Import CONTAINER_PREFIX for internal use (it's also re-exported from types)
import { CONTAINER_PREFIX } from './types';

/**
 * Extract instance ID number from container name.
 * Container names follow pattern: balenaos-vm-{num}-{timestamp}
 */
export function extractInstanceId(name: string): string {
	// CONTAINER_PREFIX is 'balenaos-vm-', so pattern matches 'balenaos-vm-{num}'
	const match = name.match(new RegExp(`^${CONTAINER_PREFIX}(\\d+)`));
	return match ? match[1] : name;
}
