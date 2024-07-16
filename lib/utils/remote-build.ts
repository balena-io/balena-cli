/*
Copyright 2016-2020 Balena Ltd.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
import type { BalenaSDK } from 'balena-sdk';
import * as JSONStream from 'JSONStream';
import * as readline from 'readline';
import * as request from 'request';
import type { RegistrySecrets } from '@balena/compose/dist/multibuild';
import type * as Stream from 'stream';
import streamToPromise = require('stream-to-promise');
import type { Pack } from 'tar-stream';

import { ExpectedError, SIGINTError } from '../errors.js';
import { tarDirectory } from './compose_ts.js';
import { getVisuals, stripIndent } from './lazy.js';
import Logger from './logger.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const globalLogger = Logger.getLogger();

const DEBUG_MODE = !!process.env.DEBUG;

const CURSOR_METADATA_REGEX = /([a-z]+)([0-9]+)?/;
const TRIM_REGEX = /\n+$/;

export interface BuildOpts {
	dockerfilePath: string;
	emulated: boolean;
	nocache: boolean;
	registrySecrets: RegistrySecrets;
	headless: boolean;
	convertEol: boolean;
	multiDockerignore: boolean;
	isDraft: boolean;
}

export interface RemoteBuild {
	appSlug: string;
	source: string;
	auth: string;
	baseUrl: string;
	opts: BuildOpts;
	sdk: BalenaSDK;
	// For internal use
	releaseId?: number;
	hadError?: boolean;
}

interface BuilderMessage {
	message: string;
	type?: string;
	replace?: boolean;
	isError?: boolean;
	// These will be set when the type === 'metadata'
	resource?: string;
	value?: string;
}

interface HeadlessBuilderMessage {
	started: boolean;
	error?: string;
	message?: string;
	releaseId?: number;
}

export class RemoteBuildFailedError extends ExpectedError {
	public constructor(message = 'Remote build failed') {
		super(message);
	}
}

async function getBuilderEndpoint(
	baseUrl: string,
	appSlug: string,
	opts: BuildOpts,
): Promise<string> {
	const querystring = await import('querystring');
	const args = querystring.stringify({
		slug: appSlug,
		dockerfilePath: opts.dockerfilePath,
		emulated: opts.emulated,
		nocache: opts.nocache,
		headless: opts.headless,
		isdraft: opts.isDraft,
	});
	// Note that using https (rather than http) is a requirement when using the
	// --registry-secrets feature, as the secrets are not otherwise encrypted.
	let builderUrl =
		process.env.BALENARC_BUILDER_URL || `https://builder.${baseUrl}`;
	if (builderUrl.endsWith('/')) {
		builderUrl = builderUrl.slice(0, -1);
	}
	return `${builderUrl}/v3/build?${args}`;
}

export async function startRemoteBuild(
	build: RemoteBuild,
): Promise<number | undefined> {
	const [buildRequest, stream] = await getRemoteBuildStream(build);

	// Setup CTRL-C handler so the user can interrupt the build
	let cancellationPromise = Promise.resolve();
	const sigintHandler = () => {
		process.exitCode = 130;
		console.error('\nReceived SIGINT, cleaning up. Please wait.');
		try {
			cancellationPromise = cancelBuildIfNecessary(build);
		} catch (err) {
			console.error(err.message);
		} finally {
			buildRequest.abort();
			const sigintErr = new SIGINTError('Build aborted on SIGINT signal');
			sigintErr.code = 'SIGINT';
			stream.emit('error', sigintErr);
		}
	};

	const { addSIGINTHandler } = await import('./helpers.js');
	addSIGINTHandler(sigintHandler);

	try {
		if (build.opts.headless) {
			await handleHeadlessBuildStream(build, stream);
		} else {
			await handleRemoteBuildStream(build, stream);
		}
	} finally {
		process.removeListener('SIGINT', sigintHandler);
		globalLogger.outputDeferredMessages();
		await cancellationPromise;
	}
	return build.releaseId;
}

async function handleRemoteBuildStream(
	build: RemoteBuild,
	stream: Stream.Stream,
) {
	await new Promise((resolve, reject) => {
		const msgHandler = getBuilderMessageHandler(build);
		stream.on('data', msgHandler);
		stream.once('end', resolve);
		stream.once('error', reject);
	});
	if (build.hadError) {
		throw new RemoteBuildFailedError();
	}
}

async function handleHeadlessBuildStream(
	build: RemoteBuild,
	stream: Stream.Stream,
) {
	// We're running a headless build, which means we'll
	// get a single object back, detailing if the build has
	// been started
	let message: HeadlessBuilderMessage;
	try {
		const response = await streamToPromise(stream as NodeJS.ReadStream);
		message = JSON.parse(response.toString());
	} catch (e) {
		if (e.code === 'SIGINT') {
			throw e;
		}
		throw new Error(
			`There was an error reading the response from the remote builder: ${e}`,
		);
	}
	if (!process.stdout.isTTY) {
		process.stdout.write(JSON.stringify(message));
		return;
	}
	if (message.started) {
		console.log('Build successfully started');
		console.log(`  Release ID: ${message.releaseId!}`);
		build.releaseId = message.releaseId;
	} else {
		console.log('Failed to start remote build');
		console.log(`  Error: ${message.error!}`);
		console.log(`  Message: ${message.message!}`);
	}
}

function handleBuilderMetadata(obj: BuilderMessage, build: RemoteBuild) {
	switch (obj.resource) {
		case 'cursor': {
			if (obj.value == null) {
				return;
			}

			const match = obj.value.match(CURSOR_METADATA_REGEX);

			if (!match) {
				// FIXME: Make this error nicer.
				console.log(
					stripIndent`
					Warning: ignoring unknown builder command. You may experience
					odd build output. Maybe you need to update balena-cli?`,
				);
				return;
			}

			const value = match[1];
			const amount = Number(match[2]) || 1;

			switch (value) {
				case 'erase':
					readline.clearLine(process.stdout, 0);
					process.stdout.write('\r');
					break;
				case 'up':
					readline.moveCursor(process.stdout, 0, -amount);
					break;
				case 'down':
					readline.moveCursor(process.stdout, 0, amount);
					break;
			}

			break;
		}
		case 'buildLogId':
			// The name of this resource is slightly dated, but this is the release
			// id from the API. We need to save this so that if the user ctrl+c's the
			// build we can cancel it on the API.
			build.releaseId = parseInt(obj.value!, 10);
			break;
	}
}

function getBuilderMessageHandler(
	build: RemoteBuild,
): (obj: BuilderMessage) => void {
	return (obj: BuilderMessage) => {
		if (DEBUG_MODE) {
			console.error(`[debug] handling message: ${JSON.stringify(obj)}`);
		}
		if (obj.type != null && obj.type === 'metadata') {
			return handleBuilderMetadata(obj, build);
		}
		if (obj.message) {
			readline.clearLine(process.stdout, 0);

			const message = obj.message.replace(TRIM_REGEX, '');
			if (obj.replace) {
				process.stdout.write(`\r${message}`);
			} else {
				process.stdout.write(`\r${message}\n`);
			}
		}
		if (obj.isError) {
			build.hadError = true;
		}
	};
}

async function cancelBuildIfNecessary(build: RemoteBuild): Promise<void> {
	if (build.releaseId != null) {
		console.error(
			`Setting 'cancelled' release status for release ID ${build.releaseId} ...`,
		);
		await build.sdk.pine.patch({
			resource: 'release',
			id: build.releaseId,
			options: {
				$filter: {
					status: { $ne: 'success' },
				},
			},
			body: {
				status: 'cancelled',
				end_timestamp: Date.now(),
			},
		});
	}
}

/**
 * Call tarDirectory() with a suitable callback to insert registry secrets in
 * the tar stream, and return the stream.
 */
async function getTarStream(build: RemoteBuild): Promise<Stream.Readable> {
	let tarSpinner = {
		start: () => {
			/* noop*/
		},
		stop: () => {
			/* noop*/
		},
	};
	if (process.stdout.isTTY) {
		const visuals = getVisuals();
		tarSpinner = new visuals.Spinner('Packaging the project source...');
	}

	const path = await import('path');
	const preFinalizeCallback = (pack: Pack) => {
		pack.entry(
			{ name: '.balena/registry-secrets.json' },
			JSON.stringify(build.opts.registrySecrets),
		);
	};

	try {
		tarSpinner.start();
		const preFinalizeCb =
			Object.keys(build.opts.registrySecrets).length > 0
				? preFinalizeCallback
				: undefined;
		globalLogger.logDebug('Tarring all non-ignored files...');
		const tarStartTime = Date.now();
		const tarStream = await tarDirectory(path.resolve(build.source), {
			preFinalizeCallback: preFinalizeCb,
			convertEol: build.opts.convertEol,
			multiDockerignore: build.opts.multiDockerignore,
		});
		globalLogger.logDebug(
			`Tarring complete in ${Date.now() - tarStartTime} ms`,
		);
		return tarStream;
	} finally {
		tarSpinner.stop();
	}
}

/**
 * Initiate a POST HTTP request to the remote builder and add some event
 * listeners.
 *
 * ¡! Note: this function must be synchronous because of a bug in the `request`
 *    library that requires the following two steps to take place in the same
 *    iteration of Node's event loop: (1) adding a listener for the 'response'
 *    event and (2) calling request.pipe():
 *    https://github.com/request/request/issues/887
 */
function createRemoteBuildRequest(
	build: RemoteBuild,
	tarStream: Stream.Readable,
	builderUrl: string,
	onError: (error: Error) => void,
): request.Request {
	const zlib = require('zlib') as typeof import('zlib');
	if (DEBUG_MODE) {
		console.error(`[debug] Connecting to builder at ${builderUrl}`);
	}
	return request
		.post({
			url: builderUrl,
			auth: { bearer: build.auth },
			headers: { 'Content-Encoding': 'gzip' },
			body: tarStream.pipe(zlib.createGzip({ level: 6 })),
		})
		.once('error', onError) // `.once` because the handler re-emits
		.once('response', (response: request.RequestResponse) => {
			if (response.statusCode >= 100 && response.statusCode < 400) {
				if (DEBUG_MODE) {
					console.error(
						`[debug] received HTTP ${response.statusCode} ${response.statusMessage}`,
					);
				}
			} else {
				const msgArr = [
					'Remote builder responded with HTTP error:',
					`${response.statusCode} ${response.statusMessage}`,
				];
				if (response.body) {
					msgArr.push(response.body);
				}
				onError(new ExpectedError(msgArr.join('\n')));
			}
		});
}

async function getRemoteBuildStream(
	build: RemoteBuild,
): Promise<[request.Request, Stream.Stream]> {
	const builderUrl = await getBuilderEndpoint(
		build.baseUrl,
		build.appSlug,
		build.opts,
	);
	let stream: Stream.Stream;
	let uploadSpinner = {
		stop: () => {
			/* noop */
		},
	};
	const onError = (error: Error) => {
		uploadSpinner.stop();
		if (stream) {
			stream.emit('error', error);
		}
	};
	// We only show the spinner when outputting to a tty
	if (process.stdout.isTTY) {
		const visuals = getVisuals();
		uploadSpinner = new visuals.Spinner(
			`Uploading source package to ${new URL(builderUrl).origin}`,
		);
		(uploadSpinner as any).start();
	}

	const tarStream = await getTarStream(build);
	const buildRequest = createRemoteBuildRequest(
		build,
		tarStream,
		builderUrl,
		onError,
	);
	if (build.opts.headless) {
		stream = buildRequest;
	} else {
		stream = buildRequest.pipe(JSONStream.parse('*')) as NodeJS.ReadStream;
	}
	stream = stream
		.once('error', () => uploadSpinner.stop())
		.once('close', () => uploadSpinner.stop())
		.once('data', () => uploadSpinner.stop())
		.once('end', () => uploadSpinner.stop())
		.once('finish', () => uploadSpinner.stop());
	return [buildRequest, stream];
}
