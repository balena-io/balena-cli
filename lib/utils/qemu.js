/**
 * @license
 * Copyright 2017-2020 Balena Ltd.
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

import * as Promise from 'bluebird';
import { getBalenaSdk } from './lazy';
export const QEMU_VERSION = 'v4.0.0-balena';
export const QEMU_BIN_NAME = 'qemu-execve';

export function qemuPathInContext(context) {
	const path = require('path');
	const binDir = path.join(context, '.balena');
	const binPath = path.join(binDir, QEMU_BIN_NAME);
	return path.relative(context, binPath);
}

export function copyQemu(context, arch) {
	const path = require('path');
	const fs = require('mz/fs');
	// Create a hidden directory in the build context, containing qemu
	const binDir = path.join(context, '.balena');
	const binPath = path.join(binDir, QEMU_BIN_NAME);

	return Promise.resolve(fs.mkdir(binDir))
		.catch({ code: 'EEXIST' }, function() {
			// noop
		})
		.then(() => getQemuPath(arch))
		.then(
			qemu =>
				new Promise(function(resolve, reject) {
					const read = fs.createReadStream(qemu);
					const write = fs.createWriteStream(binPath);

					read
						.on('error', reject)
						.pipe(write)
						.on('error', reject)
						.on('finish', resolve);
				}),
		)
		.then(() => fs.chmod(binPath, '755'))
		.then(() => path.relative(context, binPath));
}

export const getQemuPath = function(arch) {
	const balena = getBalenaSdk();
	const path = require('path');
	const fs = require('mz/fs');

	return balena.settings.get('binDirectory').then(binDir =>
		Promise.resolve(fs.mkdir(binDir))
			.catch({ code: 'EEXIST' }, function() {
				// noop
			})
			.then(() =>
				path.join(binDir, `${QEMU_BIN_NAME}-${arch}-${QEMU_VERSION}`),
			),
	);
};

export function installQemu(arch) {
	const request = require('request');
	const fs = require('fs');
	const zlib = require('zlib');
	const tar = require('tar-stream');

	return getQemuPath(arch).then(
		qemuPath =>
			new Promise(function(resolve, reject) {
				const installStream = fs.createWriteStream(qemuPath);

				const qemuArch = balenaArchToQemuArch(arch);
				const downloadArchiveName = `qemu-${QEMU_VERSION.replace(
					/^v/,
					'',
				)}-${qemuArch}.tar.gz`;
				const qemuUrl = `https://github.com/balena-io/qemu/releases/download/${QEMU_VERSION}/${downloadArchiveName}`;

				const extract = tar.extract();
				extract.on('entry', function(header, stream, next) {
					stream.on('end', next);
					if (header.name.includes(`qemu-${qemuArch}-static`)) {
						stream.pipe(installStream);
					} else {
						stream.resume();
					}
				});

				return request(qemuUrl)
					.on('error', reject)
					.pipe(zlib.createGunzip())
					.on('error', reject)
					.pipe(extract)
					.on('error', reject)
					.on('finish', function() {
						fs.chmodSync(qemuPath, '755');
						resolve();
					});
			}),
	);
}

var balenaArchToQemuArch = function(arch) {
	switch (arch) {
		case 'armv7hf':
		case 'rpi':
		case 'armhf':
			return 'arm';
		case 'aarch64':
			return 'aarch64';
		default:
			throw new Error(`Cannot install emulator for architecture ${arch}`);
	}
};
