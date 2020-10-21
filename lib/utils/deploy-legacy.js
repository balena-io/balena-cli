/**
 * @license
 * Copyright 2020 Balena Ltd.
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

import { getVisuals } from './lazy';
import { promisify } from 'util';

const getBuilderPushEndpoint = function (baseUrl, owner, app) {
	const querystring = require('querystring');
	const args = querystring.stringify({ owner, app });
	return `https://builder.${baseUrl}/v1/push?${args}`;
};

const getBuilderLogPushEndpoint = function (baseUrl, buildId, owner, app) {
	const querystring = require('querystring');
	const args = querystring.stringify({ owner, app, buildId });
	return `https://builder.${baseUrl}/v1/pushLogs?${args}`;
};

/**
 * @param {import('docker-toolbelt')} docker
 * @param {string} imageId
 * @param {string} bufferFile
 */
const bufferImage = function (docker, imageId, bufferFile) {
	const streamUtils = require('./streams');

	const image = docker.getImage(imageId);
	const sizePromise = image.inspect().then((img) => img.Size);

	return Promise.all([image.get(), sizePromise]).then(
		([imageStream, imageSize]) =>
			streamUtils.buffer(imageStream, bufferFile).then((bufferedStream) => {
				// @ts-ignore adding an extra property
				bufferedStream.length = imageSize;
				return bufferedStream;
			}),
	);
};

const showPushProgress = function (message) {
	const visuals = getVisuals();
	const progressBar = new visuals.Progress(message);
	progressBar.update({ percentage: 0 });
	return progressBar;
};

const uploadToPromise = (uploadRequest, logger) =>
	new Promise(function (resolve, reject) {
		const handleMessage = function (data) {
			let obj;
			data = data.toString();
			logger.logDebug(`Received data: ${data}`);

			try {
				obj = JSON.parse(data);
			} catch (e) {
				logger.logError('Error parsing reply from remote side');
				reject(e);
				return;
			}

			switch (obj.type) {
				case 'error':
					reject(new Error(`Remote error: ${obj.error}`));
					break;
				case 'success':
					resolve(obj);
					break;
				case 'status':
					logger.logInfo(obj.message);
					break;
				default:
					reject(new Error(`Received unexpected reply from remote: ${data}`));
			}
		};

		uploadRequest.on('error', reject).on('data', handleMessage);
	});

/**
 * @returns {Promise<{ buildId: number }>}
 */
const uploadImage = function (
	imageStream,
	token,
	username,
	url,
	appName,
	logger,
) {
	const request = require('request');
	const progressStream = require('progress-stream');
	const zlib = require('zlib');

	// Need to strip off the newline
	const progressMessage = logger
		.formatMessage('info', 'Uploading')
		.slice(0, -1);
	const progressBar = showPushProgress(progressMessage);
	const streamWithProgress = imageStream.pipe(
		progressStream(
			{
				time: 500,
				length: imageStream.length,
			},
			({ percentage, eta }) =>
				progressBar.update({
					percentage: Math.min(percentage, 100),
					eta,
				}),
		),
	);

	const uploadRequest = request.post({
		url: getBuilderPushEndpoint(url, username, appName),
		headers: {
			'Content-Encoding': 'gzip',
		},
		auth: {
			bearer: token,
		},
		body: streamWithProgress.pipe(
			zlib.createGzip({
				level: 6,
			}),
		),
	});

	return uploadToPromise(uploadRequest, logger);
};

const uploadLogs = function (logs, token, url, buildId, username, appName) {
	const request = require('request');
	return request.post({
		json: true,
		url: getBuilderLogPushEndpoint(url, buildId, username, appName),
		auth: {
			bearer: token,
		},
		body: Buffer.from(logs),
	});
};

/**
 * @param {import('docker-toolbelt')} docker
 * @param {import('./logger')} logger
 * @param {string} token
 * @param {string} username
 * @param {string} url
 * @param {{appName: string; imageName: string; buildLogs: string; shouldUploadLogs: boolean}} opts
 * - appName: the name of the app to deploy to
 * - imageName: the name of the image to deploy
 * - buildLogs: a string with build output
 */
export const deployLegacy = async function (
	docker,
	logger,
	token,
	username,
	url,
	opts,
) {
	const tmp = require('tmp');
	const tmpNameAsync = promisify(tmp.tmpName);

	// Ensure the tmp files gets deleted
	tmp.setGracefulCleanup();

	const { appName, imageName, buildLogs, shouldUploadLogs } = opts;
	const logs = buildLogs;

	const bufferFile = await tmpNameAsync();

	logger.logInfo('Initializing deploy...');
	const { buildId } = await bufferImage(docker, imageName, bufferFile)
		.then((stream) =>
			uploadImage(stream, token, username, url, appName, logger),
		)
		.finally(() =>
			// If the file was never written to (for instance because an error
			// has occured before any data was written) this call will throw an
			// ugly error, just suppress it

			require('fs')
				.promises.unlink(bufferFile)
				.catch(() => undefined),
		);

	if (shouldUploadLogs) {
		logger.logInfo('Uploading logs...');
		const args = await Promise.all([
			logs,
			token,
			url,
			buildId,
			username,
			appName,
		]);
		await uploadLogs(...args);
	}

	return buildId;
};
