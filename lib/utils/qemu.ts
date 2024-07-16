/**
 * @license
 * Copyright 2017-2021 Balena Ltd.
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

import { ExpectedError } from '../errors.js';
import { getBalenaSdk, stripIndent } from './lazy.js';
import type Logger from './logger.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

export const QEMU_VERSION = 'v7.0.0+balena1';
export const QEMU_BIN_NAME = 'qemu-execve';

export function qemuPathInContext(context: string) {
	const path = require('path') as typeof import('path');
	const binDir = path.join(context, '.balena');
	const binPath = path.join(binDir, QEMU_BIN_NAME);
	return path.relative(context, binPath);
}

export async function copyQemu(context: string, arch: string) {
	const path = await import('path');
	const fs = await import('fs');
	// Create a hidden directory in the build context, containing qemu
	const binDir = path.join(context, '.balena');
	const binPath = path.join(binDir, QEMU_BIN_NAME);

	return fs.promises
		.mkdir(binDir)
		.catch(function (err) {
			if (err.code === 'EEXIST') {
				// ignore
				return;
			}
			throw err;
		})
		.then(() => getQemuPath(arch))
		.then(
			(qemu) =>
				new Promise(function (resolve, reject) {
					const read = fs.createReadStream(qemu);
					const write = fs.createWriteStream(binPath);

					read
						.on('error', reject)
						.pipe(write)
						.on('error', reject)
						.on('finish', resolve);
				}),
		)
		.then(() => fs.promises.chmod(binPath, '755'))
		.then(() => path.relative(context, binPath));
}

export const getQemuPath = async function (balenaArch: string) {
	const qemuArch = balenaArchToQemuArch(balenaArch);
	const balena = getBalenaSdk();
	const path = await import('path');
	const { promises: fs } = await import('fs');

	return balena.settings.get('binDirectory').then((binDir) =>
		fs
			.mkdir(binDir)
			.catch(function (err) {
				if (err.code === 'EEXIST') {
					// ignore
					return;
				}
				throw err;
			})
			.then(() =>
				path.join(binDir, `${QEMU_BIN_NAME}-${qemuArch}-${QEMU_VERSION}`),
			),
	);
};

async function installQemu(arch: string, qemuPath: string) {
	const qemuArch = balenaArchToQemuArch(arch);
	const fileVersion = QEMU_VERSION.replace('v', '').replace('+', '.');
	const urlFile = encodeURIComponent(`qemu-${fileVersion}-${qemuArch}.tar.gz`);
	const urlVersion = encodeURIComponent(QEMU_VERSION);
	const qemuUrl = `https://github.com/balena-io/qemu/releases/download/${urlVersion}/${urlFile}`;

	const { default: request } = await import('request');
	const fs = await import('fs');
	const zlib = await import('zlib');
	const tar = await import('tar-stream');

	// createWriteStream creates a zero-length file on disk that
	// needs to be deleted if the download fails
	const installStream = fs.createWriteStream(qemuPath);
	try {
		await new Promise<void>((resolve, reject) => {
			const extract = tar.extract();
			extract.on('entry', function (header, stream, next) {
				try {
					stream.on('end', next);
					if (header.name.includes(`qemu-${qemuArch}-static`)) {
						stream.pipe(installStream);
					} else {
						stream.resume();
					}
				} catch (err) {
					reject(err);
				}
			});
			request(qemuUrl)
				.on('error', reject)
				.pipe(zlib.createGunzip())
				.on('error', reject)
				.pipe(extract)
				.on('error', reject)
				.on('finish', function () {
					fs.chmodSync(qemuPath, '755');
					resolve();
				});
		});
	} catch (err) {
		try {
			await fs.promises.unlink(qemuPath);
		} catch {
			// ignore
		}
		throw err;
	}
}

const balenaArchToQemuArch = function (arch: string) {
	switch (arch) {
		case 'rpi':
		case 'arm':
		case 'armhf':
		case 'armv7hf':
			return 'arm';
		case 'arm64':
		case 'aarch64':
			return 'aarch64';
		default:
			throw new ExpectedError(stripIndent`
				Unknown ARM architecture identifier "${arch}".
				Known ARM identifiers: rpi arm armhf armv7hf arm64 aarch64`);
	}
};

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
	const { promises: fs } = await import('fs');
	const qemuPath = await getQemuPath(arch);
	try {
		const stats = await fs.stat(qemuPath);
		// Earlier versions of the CLI with broken error handling would leave
		// behind files with size 0. If such a file is found, delete it.
		if (stats.size === 0) {
			await fs.unlink(qemuPath);
		}
		await fs.access(qemuPath);
	} catch {
		// QEMU not found in cache folder (~/.balena/bin/), so install it
		logger.logInfo(`Installing qemu for ${arch} emulation...`);
		await installQemu(arch, qemuPath);
	}
	return true;
}

/**
 * Check whether the Docker daemon (including balenaEngine) requires explicit
 * QEMU emulation setup. Note that Docker Desktop (Windows and Mac), and also
 * the older Docker for Mac, have built-in support for binfmt_misc, so they
 * do not require explicit QEMU setup. References:
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
	// Docker Desktop (Windows and Mac) with Docker Engine 19.03 reports:
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
