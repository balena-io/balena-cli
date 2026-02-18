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

/**
 * Supported device types for virtual devices.
 * Maps to balenaOS generic device types that support QEMU emulation.
 * Used for architecture detection and cross-emulation warnings.
 */
export type VirtDeviceType = 'generic-amd64' | 'generic-aarch64';

/**
 * Container status from Docker.
 */
export type ContainerStatus = 'running' | 'exited' | 'paused' | 'created';

/**
 * Represents a running or stopped virtual device instance.
 */
export interface VirtInstance {
	/** Docker container name (e.g., balenaos-vm-1) */
	name: string;
	/** Docker container ID */
	containerId: string;
	/** Current container status */
	status: ContainerStatus;
	/** Host port mapped to VM's SSH port (22) */
	sshPort: number;
	/** ISO timestamp when the container was created */
	created: string;
}

/**
 * Options for the Docker image builder.
 */
export interface DockerBuildOptions {
	/** Force rebuild even if image exists (deprecated, no longer used) */
	forceRebuild?: boolean;
	/** Build context path */
	contextPath?: string;
	/** Optional Docker client for testing (dependency injection) */
	docker?: import('dockerode');
}

/**
 * Prefix used for all virtual device Docker containers.
 */
export const CONTAINER_PREFIX = 'balenaos-vm-';

/**
 * Default Docker image name for the QEMU runner.
 */
export const DOCKER_IMAGE_NAME = 'balena-qemu-runner';

/**
 * Default base SSH port. Instances will use consecutive ports.
 */
export const DEFAULT_SSH_BASE_PORT = 22222;
