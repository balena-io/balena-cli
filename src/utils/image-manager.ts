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

import type * as SDK from 'balena-sdk';
import { getBalenaSdk } from './lazy';

// eslint-disable-next-line no-useless-escape
const BALENAOS_VERSION_REGEX = /v?\d+\.\d+\.\d+(\.rev\d+)?((\-|\+).+)?/;

/**
 * @summary Check if the string is a valid balenaOS version number
 * @description Throws an error if the version is invalid
 *
 * @param {String} version - version number to validate
 * @returns {void} the most recent compatible version.
 */
const validateVersion = (version: string) => {
	if (!BALENAOS_VERSION_REGEX.test(version)) {
		throw new Error('Invalid version number');
	}
};

/**
 * @summary Get file created date
 *
 * @param {String} filePath - file path
 * @returns {Promise<Date>} date since creation
 *
 * @example
 * getFileCreatedDate('foo/bar').then (createdTime) ->
 * 	console.log("The file was created in #{createdTime}")
 */
export const getFileCreatedDate = async (filePath: string) => {
	const { promises: fs } = await import('fs');
	const { ctime } = await fs.stat(filePath);
	return ctime;
};

/**
 * @summary Get path to image in cache
 *
 * @param {String} deviceType - device type slug or alias
 * @param {String} version - the exact balenaOS version number
 * @returns {Promise<String>} image path
 *
 * @example
 * getImagePath('raspberry-pi', '1.2.3').then (imagePath) ->
 * 	console.log(imagePath)
 */
export const getImagePath = async (deviceType: string, version?: string) => {
	if (typeof version === 'string') {
		validateVersion(version);
	}
	const balena = getBalenaSdk();
	const [cacheDirectory, deviceTypeInfo] = await Promise.all([
		balena.settings.get('cacheDirectory'),
		balena.models.config.getDeviceTypeManifestBySlug(deviceType),
	]);
	const extension = deviceTypeInfo.yocto.fstype === 'zip' ? 'zip' : 'img';
	const path = await import('path');
	return path.join(cacheDirectory, `${deviceType}-v${version}.${extension}`);
};

/**
 * @summary Determine if a device image is cached
 *
 * @description
 * If the device image does not exist, return false.
 *
 * @param {String} deviceType - device type slug or alias
 * @param {String} version - the exact balenaOS version number
 * @returns {Promise<Boolean>} is image cached
 *
 * @example
 * isImageCached ('raspberry-pi', '1.2.3').then (isCached) ->
 * 	if isCached
 * 		console.log('The Raspberry Pi image v1.2.3 is cached!')
 */
export const isImageCached = async (deviceType: string, version: string) => {
	const imagePath = await getImagePath(deviceType, version);
	try {
		const createdDate = await getFileCreatedDate(imagePath);
		return createdDate != null;
	} catch {
		return false;
	}
};

/**
 * Heuristically determine whether the given semver version is a balenaOS
 * ESR version.
 *
 * @param {string} version Semver version. If invalid or range, return false.
 */
export const isESR = (version: string) => {
	const match = version.match(/^v?(\d+)\.\d+\.\d+/);
	const major = parseInt(match?.[1] ?? '', 10);
	return major >= 2018; // note: (NaN >= 2018) is false
};

/**
 * Returns whether the OS version is 'esr' or 'default'
 */
export const getOsType = (version: string) =>
	isESR(version) ? 'esr' : 'default';

/**
 * @summary Get the most recent compatible version
 *
 * @param {String} deviceType - device type slug or alias
 * @param {String} versionOrRange - supports the same version options
 * as `balena.models.os.getMaxSatisfyingVersion`.
 * See `getStream` for the detailed explanation.
 * @returns {Promise<String>} the most recent compatible version.
 */
const resolveVersion = async (deviceType: string, versionOrRange: string) => {
	const balena = getBalenaSdk();
	const version = await balena.models.os.getMaxSatisfyingVersion(
		deviceType,
		versionOrRange,
		getOsType(versionOrRange),
	);
	if (!version) {
		throw new Error('No such version for the device type');
	}
	return version;
};

/**
 * @summary Get an image from the cache
 *
 * @param {String} deviceType - device type slug or alias
 * @param {String} version - the exact balenaOS version number
 * @returns {Promise<fs.ReadStream>} image readable stream
 *
 * @example
 * getImage('raspberry-pi', '1.2.3').then (stream) ->
 * 	stream.pipe(fs.createWriteStream('foo/bar.img'))
 */
export const getImage = async (deviceType: string, version: string) => {
	const imagePath = await getImagePath(deviceType, version);
	const fs = await import('fs');
	const stream = fs.createReadStream(imagePath) as ReturnType<
		typeof fs.createReadStream
	> & { mime: string };
	// Default to application/octet-stream if we could not find a more specific mime type

	const { getType } = await import('mime');
	stream.mime = getType(imagePath) ?? 'application/octet-stream';
	return stream;
};

/**
 * @summary Get a writable stream for an image in the cache
 *
 * @param {String} deviceType - device type slug or alias
 * @param {String} version - the exact balenaOS version number
 * @returns {Promise<fs.WriteStream & { persistCache: () => Promise<void>, removeCache: () => Promise<void> }>} image writable stream
 *
 * @example
 * getImageWritableStream('raspberry-pi', '1.2.3').then (stream) ->
 * 	fs.createReadStream('foo/bar').pipe(stream)
 */
export const getImageWritableStream = async (
	deviceType: string,
	version?: string,
) => {
	const imagePath = await getImagePath(deviceType, version);

	// Ensure the cache directory exists, to prevent
	// ENOENT errors when trying to write to it.
	const path = await import('path');
	const { promises: fs, createWriteStream } = await import('node:fs');
	await fs.mkdir(path.dirname(imagePath), { recursive: true });

	// Append .inprogress to streams, move them to the right location only on success
	const inProgressPath = imagePath + '.inprogress';
	type ImageWritableStream = ReturnType<typeof createWriteStream> &
		Record<'persistCache' | 'removeCache', () => Promise<void>>;
	const stream = createWriteStream(inProgressPath) as ImageWritableStream;

	// Call .isCompleted on the stream
	stream.persistCache = () => fs.rename(inProgressPath, imagePath);

	stream.removeCache = () => fs.unlink(inProgressPath);

	return stream;
};

type DownloadConfig = NonNullable<
	Parameters<SDK.BalenaSDK['models']['os']['download']>[0]
>;

const doDownload = async (options: DownloadConfig) => {
	const balena = getBalenaSdk();
	const imageStream = await balena.models.os.download(options);
	// Piping to a PassThrough stream is needed to be able
	// to then pipe the stream to multiple destinations.
	const { PassThrough } = await import('stream');
	const pass = new PassThrough();
	imageStream.pipe(pass);

	// Save a copy of the image in the cache
	const cacheStream = await getImageWritableStream(
		options.deviceType,
		options.version,
	);

	pass.pipe(cacheStream, { end: false });
	pass.on('end', cacheStream.persistCache);

	// If we return `pass` directly, the client will not be able
	// to read all data from it after a delay, since it will be
	// instantly piped to `cacheStream`.
	// The solution is to create yet another PassThrough stream,
	// pipe to it and return the new stream instead.
	const pass2 = new PassThrough() as InstanceType<typeof PassThrough> & {
		mime: string;
	};
	pass2.mime = imageStream.mime;
	imageStream.on('progress', (state) => pass2.emit('progress', state));

	imageStream.on('error', async (err) => {
		await cacheStream.removeCache();
		pass2.emit('error', err);
	});

	return pass.pipe(pass2);
};

/**
 * @summary Get a device operating system image
 * @public
 *
 * @description
 * This function saves a copy of the downloaded image in the cache directory setting specified in [balena-settings-client](https://github.com/balena-io-modules/balena-settings-client).
 *
 * @param {String} deviceType - device type slug or alias
 * @param {String} versionOrRange - can be one of
 * * the exact version number,
 * in which case it is used if the version is supported,
 * or the promise is rejected,
 * * a [semver](https://www.npmjs.com/package/semver)-compatible
 * range specification, in which case the most recent satisfying version is used
 * if it exists, or the promise is rejected,
 * * `'latest'` in which case the most recent version is returned, excluding pre-releases.
 *   The promise is rejected if only pre-release versions are available,
 * Defaults to `'latest'`.
 * @param {Object} options
 * @param {boolean} options?.developmentMode
 * @returns {Promise<NodeJS.ReadableStream>} image readable stream
 *
 * @example
 * getStream('raspberry-pi', 'latest').then (stream) ->
 * 	stream.pipe(fs.createWriteStream('foo/bar.img'))
 */
export const getStream = async (
	deviceType: string,
	versionOrRange?: string,
	options: Omit<DownloadConfig, 'deviceType' | 'version'> = {},
) => {
	versionOrRange ??= 'latest';
	const version = await resolveVersion(deviceType, versionOrRange);
	const existsInCache = await isImageCached(deviceType, version);
	const $stream = existsInCache
		? await getImage(deviceType, version)
		: await doDownload({ ...options, deviceType, version });
	// schedule the 'version' event for the next iteration of the event loop
	// so that callers have a chance of adding an event handler
	setImmediate(() =>
		$stream.emit('balena-image-manager:resolved-version', version),
	);
	return $stream;
};
