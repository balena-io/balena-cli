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
import { RegistrySecrets } from 'resin-multibuild';
import type * as Stream from 'stream';
import streamToPromise = require('stream-to-promise');
import type { Pack } from 'tar-stream';

import { ExpectedError } from '../errors';
import { exitWithExpectedError } from '../errors';
import { tarDirectory } from './compose_ts';
import { getVisuals, stripIndent } from './lazy';
import Logger = require('./logger');

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
}

export interface RemoteBuild {
	app: string;
	owner: string;
	source: string;
	auth: string;
	baseUrl: string;
	nogitignore: boolean;
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
	owner: string,
	app: string,
	opts: BuildOpts,
): Promise<string> {
	const querystring = await import('querystring');
	const args = querystring.stringify({
		owner,
		app,
		dockerfilePath: opts.dockerfilePath,
		emulated: opts.emulated,
		nocache: opts.nocache,
		headless: opts.headless,
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

export async function startRemoteBuild(build: RemoteBuild): Promise<void> {
	const stream = await getRemoteBuildStream(build);

	// Special windows handling (win64 also reports win32)
	if (process.platform === 'win32') {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		rl.on('SIGINT', () => process.emit('SIGINT' as any));
	}

	if (!build.opts.headless) {
		return awaitRemoteBuildStream(build, stream);
	}

	// We're running a headless build, which means we'll
	// get a single object back, detailing if the build has
	// been started
	let result: HeadlessBuilderMessage;
	try {
		const response = await streamToPromise(stream);
		result = JSON.parse(response.toString());
	} catch (e) {
		throw new Error(
			`There was an error reading the response from the remote builder: ${e}`,
		);
	}
	handleHeadlessBuildMessage(result);
}

async function awaitRemoteBuildStream(
	build: RemoteBuild,
	stream: NodeJS.ReadWriteStream,
) {
	let sigintHandler: (() => Promise<void>) | null = null;
	try {
		await new Promise((resolve, reject) => {
			// Setup interrupt handlers so we can cancel the build if the user presses
			// ctrl+c
			sigintHandler = async () => {
				process.exitCode = 130;
				console.error('Received SIGINT, cleaning up. Please wait.');
				try {
					await cancelBuildIfNecessary(build);
				} catch (err) {
					console.error(err.message);
				} finally {
					stream.end();
				}
			};
			process.once('SIGINT', sigintHandler);
			stream.on('data', getBuilderMessageHandler(build));
			stream.on('end', resolve);
			stream.on('error', reject);
		});
	} finally {
		if (sigintHandler) {
			process.removeListener('SIGINT', sigintHandler);
		}
		globalLogger.outputDeferredMessages();
	}
	if (build.hadError) {
		throw new RemoteBuildFailedError();
	}
}

function handleHeadlessBuildMessage(message: HeadlessBuilderMessage) {
	if (!process.stdout.isTTY) {
		process.stdout.write(JSON.stringify(message));
		return;
	}

	if (message.started) {
		console.log('Build successfully started');
		console.log(`  Release ID: ${message.releaseId!}`);
	} else {
		console.log('Failed to start remote build');
		console.log(`  Error: ${message.error!}`);
		console.log(`  Message: ${message.message!}`);
	}
}

function handleBuilderMetadata(obj: BuilderMessage, build: RemoteBuild) {
	switch (obj.resource) {
		case 'cursor':
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
			const amount = match[2] || 1;

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
			/*noop*/
		},
		stop: () => {
			/*noop*/
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
		return await tarDirectory(path.resolve(build.source), {
			preFinalizeCallback: preFinalizeCb,
			convertEol: build.opts.convertEol,
			multiDockerignore: build.opts.multiDockerignore,
			nogitignore: build.nogitignore,
		});
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
		.on('error', onError)
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
				onError(new Error(msgArr.join('\n')));
			}
		});
}

async function getRemoteBuildStream(
	build: RemoteBuild,
): Promise<NodeJS.ReadWriteStream> {
	const builderUrl = await getBuilderEndpoint(
		build.baseUrl,
		build.owner,
		build.app,
		build.opts,
	);

	let uploadSpinner = {
		stop: () => {
			/* noop */
		},
	};
	let exitOnError = (error: Error) => {
		return exitWithExpectedError(error);
	};
	// We only show the spinner when outputting to a tty
	if (process.stdout.isTTY) {
		const visuals = getVisuals();
		uploadSpinner = new visuals.Spinner(
			'Uploading source package to balenaCloud',
		);
		exitOnError = (error: Error): never => {
			uploadSpinner.stop();
			return exitWithExpectedError(error);
		};
		// This is not strongly typed to start with, so we cast
		// to any to allow the method call
		(uploadSpinner as any).start();
	}

	try {
		const tarStream = await getTarStream(build);
		const buildRequest = createRemoteBuildRequest(
			build,
			tarStream,
			builderUrl,
			exitOnError,
		);
		let stream: NodeJS.ReadWriteStream;
		if (build.opts.headless) {
			stream = (buildRequest as unknown) as NodeJS.ReadWriteStream;
		} else {
			stream = buildRequest.pipe(JSONStream.parse('*'));
		}
		return stream
			.once('close', () => uploadSpinner.stop())
			.once('data', () => uploadSpinner.stop())
			.once('end', () => uploadSpinner.stop())
			.once('error', () => uploadSpinner.stop())
			.once('finish', () => uploadSpinner.stop());
	} catch (error) {
		return exitOnError(error);
	}
}
