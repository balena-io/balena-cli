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

import { getVisuals } from './lazy.js';
import { promisify } from 'util';
import type Dockerode from 'dockerode';
import type Logger from './logger.js';
import type { Request } from 'request';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const getBuilderPushEndpoint = function (
	baseUrl: string,
	owner: string,
	app: string,
) {
	const querystring = require('querystring') as typeof import('querystring');
	const args = querystring.stringify({ owner, app });
	return `https://builder.${baseUrl}/v1/push?${args}`;
};

const getBuilderLogPushEndpoint = function (
	baseUrl: string,
	buildId: number,
	owner: string,
	app: string,
) {
	const querystring = require('querystring') as typeof import('querystring');
	const args = querystring.stringify({ owner, app, buildId });
	return `https://builder.${baseUrl}/v1/pushLogs?${args}`;
};

/**
 * @param {import('dockerode')} docker
 * @param {string} imageId
 * @param {string} bufferFile
 */
const bufferImage = async function (
	docker: Dockerode,
	imageId: string,
	bufferFile: string,
): Promise<NodeJS.ReadableStream & { length: number }> {
	const streamUtils = await import('./streams.js');
	const image = docker.getImage(imageId);
	const sizePromise = image.inspect().then((img) => img.Size);

	return await Promise.all([image.get(), sizePromise]).then(
		([imageStream, imageSize]) =>
			streamUtils
				.buffer(imageStream, bufferFile)
				.then((bufferedStream: NodeJS.ReadableStream & { length?: number }) => {
					bufferedStream.length = imageSize;
					return bufferedStream as NodeJS.ReadableStream & { length: number };
				}),
	);
};

const showPushProgress = function (message: string) {
	const visuals = getVisuals();
	const progressBar = new visuals.Progress(message);
	progressBar.update({ percentage: 0 });
	return progressBar;
};

const uploadToPromise = (uploadRequest: Request, logger: Logger) =>
	new Promise<{ buildId: number }>(function (resolve, reject) {
		uploadRequest.on('error', reject).on('data', function handleMessage(data) {
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
		});
	});

/**
 * @returns {Promise<{ buildId: number }>}
 */
const uploadImage = function (
	imageStream: NodeJS.ReadableStream & { length: number },
	token: string,
	username: string,
	url: string,
	appName: string,
	logger: Logger,
): Promise<{ buildId: number }> {
	const request = require('request') as typeof import('request');
	const progressStream =
		require('progress-stream') as typeof import('progress-stream');
	const zlib = require('zlib') as typeof import('zlib');

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

const uploadLogs = function (
	logs: string,
	token: string,
	url: string,
	buildId: number,
	username: string,
	appName: string,
) {
	const request = require('request') as typeof import('request');
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
 * - appName: the name of the app to deploy to
 * - imageName: the name of the image to deploy
 * - buildLogs: a string with build output
 */
export const deployLegacy = async function (
	docker: Dockerode,
	logger: Logger,
	token: string,
	username: string,
	url: string,
	opts: {
		appName: string;
		imageName: string;
		buildLogs: string;
		shouldUploadLogs: boolean;
	},
): Promise<number> {
	const tmp = require('tmp') as typeof import('tmp');
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

			(require('fs') as typeof import('fs')).promises
				.unlink(bufferFile)
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
