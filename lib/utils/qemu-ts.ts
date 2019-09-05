/**
 * @license
 * Copyright 2019 Balena Ltd.
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

import { stripIndent } from 'common-tags';
import Dockerode = require('dockerode');

import Logger = require('./logger');
import { getQemuPath, installQemu } from './qemu';

export { QEMU_BIN_NAME } from './qemu';
export * from './qemu';

export async function installQemuIfNeeded(
	emulated: boolean,
	logger: Logger,
	arch: string,
	docker: Dockerode,
): Promise<boolean> {
	// call platformNeedsQemu() regardless of whether emulation is required,
	// because it logs useful information
	const needsQemu = await platformNeedsQemu(docker, logger);
	if (!emulated || !needsQemu) {
		return false;
	}
	const fs = await import('mz/fs');
	if (!(await fs.exists(await getQemuPath(arch)))) {
		logger.logInfo(`Installing qemu for ${arch} emulation...`);
		await installQemu(arch);
	}
	return true;
}

/**
 * Check whether the Docker daemon (including balenaEngine) requires explicit
 * QEMU emulation setup. Note that Docker Desktop (Docker for Mac), and
 * reportedly also Docker for Windows, have built-in support for binfmt_misc,
 * so they do not require explicity QEMU setup. References:
 * - https://en.wikipedia.org/wiki/Binfmt_misc
 * - https://docs.docker.com/docker-for-mac/multi-arch/
 * - https://www.ecliptik.com/Cross-Building-and-Running-Multi-Arch-Docker-Images/
 * - https://stackoverflow.com/questions/55388725/run-linux-arm-container-via-qemu-binfmt-misc-on-docker-lcow
 *
 * @param docker Dockerode instance
 */
async function platformNeedsQemu(
	docker: Dockerode,
	logger: Logger,
): Promise<boolean> {
	const dockerInfo = await docker.info();
	// Docker Desktop with Docker Engine 19.03 reports:
	//     OperatingSystem: Docker Desktop
	//     OSType: linux
	// Docker for Mac with Docker Engine 18.06 reports:
	//     OperatingSystem: Docker for Mac
	//     OSType: linux
	// On Ubuntu (standard Docker installation):
	//     OperatingSystem: Ubuntu 18.04.2 LTS (containerized)
	//     OSType: linux
	// https://stackoverflow.com/questions/38223965/how-can-i-detect-if-docker-for-mac-is-installed
	const isDockerDesktop = /(?:Docker Desktop)|(?:Docker for Mac)/i.test(
		dockerInfo.OperatingSystem,
	);
	if (isDockerDesktop) {
		logger.logInfo(stripIndent`
			Docker Desktop detected (daemon architecture: "${dockerInfo.Architecture}")
			  Docker itself will determine and enable architecture emulation if required,
			  without balena-cli intervention and regardless of the --emulated option.`);
	}
	return !isDockerDesktop;
}
