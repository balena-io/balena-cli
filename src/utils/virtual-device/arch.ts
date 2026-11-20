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

import * as os from 'os';

/**
 * Normalized host architecture type.
 * Used for emulation warnings and architecture comparisons.
 */
export type HostArchitecture = 'x64' | 'arm64';

/**
 * Map of Node.js os.arch() values to normalized architecture names.
 */
const SUPPORTED_ARCHES: Record<string, HostArchitecture> = {
	x64: 'x64',
	x86_64: 'x64',
	amd64: 'x64',
	arm64: 'arm64',
	aarch64: 'arm64',
};

/**
 * Detect the host architecture.
 *
 * @returns The normalized host architecture ('x64' or 'arm64')
 * @throws Error if the host architecture is not supported
 */
export function detectArchitecture(): HostArchitecture {
	const arch = os.arch();
	const normalized = SUPPORTED_ARCHES[arch];

	if (!normalized) {
		const supported = Object.keys(SUPPORTED_ARCHES).join(', ');
		throw new Error(
			`Unsupported architecture: ${arch}. Supported architectures: ${supported}`,
		);
	}

	return normalized;
}
