/*
Copyright 2016-2018 Balena Ltd.

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
import { BalenaSDK } from 'balena-sdk';
import * as Bluebird from 'bluebird';
import * as JSONStream from 'JSONStream';
import * as readline from 'readline';
import * as request from 'request';
import { RegistrySecrets } from 'resin-multibuild';
import * as Stream from 'stream';
import { Pack } from 'tar-stream';
import { TypedError } from 'typed-error';

import { exitWithExpectedError } from '../utils/patterns';
import { tarDirectory } from './compose';

const DEBUG_MODE = !!process.env.DEBUG;

const CURSOR_METADATA_REGEX = /([a-z]+)([0-9]+)?/;
const TRIM_REGEX = /\n+$/;

export interface BuildOpts {
	dockerfilePath: string;
	emulated: boolean;
	nocache: boolean;
	registrySecrets: RegistrySecrets;
}

export interface RemoteBuild {
	app: string;
	owner: string;
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

export class RemoteBuildFailedError extends TypedError {
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
	});
	// Note that using https (rather than http) is a requirement when using the
	// --registry-secrets feature, as the secrets are not otherwise encrypted.
	return `https://builder.${baseUrl}/v3/build?${args}`;
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

	return new Bluebird((resolve, reject) => {
		// Setup interrupt handlers so we can cancel the build if the user presses
		// ctrl+c

		// This is necessary because the `exit-hook` module is used by several
		// dependencies, and will exit without calling the following handler.
		// Once https://github.com/balena-io/balena-cli/issues/867 has been solved,
		// we are free to (and definitely should) remove the below line
		process.removeAllListeners('SIGINT');
		process.on('SIGINT', () => {
			process.stderr.write('Received SIGINT, cleaning up. Please wait.\n');
			cancelBuildIfNecessary(build).then(() => {
				stream.end();
				process.exit(130);
			});
		});

		stream.on('data', getBuilderMessageHandler(build));
		stream.on('end', resolve);
		stream.on('error', reject);
	}).then(() => {
		if (build.hadError) {
			throw new RemoteBuildFailedError();
		}
	});
}

function handleBuilderMetadata(obj: BuilderMessage, build: RemoteBuild) {
	const { stripIndent } = require('common-tags');

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
			console.log(`[debug] handling message: ${JSON.stringify(obj)}`);
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
	const path = await import('path');
	const visuals = await import('resin-cli-visuals');
	const tarSpinner = new visuals.Spinner('Packaging the project source...');
	const preFinalizeCallback = (pack: Pack) => {
		pack.entry(
			{ name: '.balena/registry-secrets.json' },
			JSON.stringify(build.opts.registrySecrets),
		);
	};

	try {
		tarSpinner.start();
		return await tarDirectory(
			path.resolve(build.source),
			Object.keys(build.opts.registrySecrets).length > 0
				? preFinalizeCallback
				: undefined,
		);
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
	const zlib = require('zlib');
	if (DEBUG_MODE) {
		console.log(`[debug] Connecting to builder at ${builderUrl}`);
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
					console.log(
						`[debug] received HTTP ${response.statusCode} ${
							response.statusMessage
						}`,
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
	const tarStream = await getTarStream(build);
	const visuals = await import('resin-cli-visuals');
	const uploadSpinner = new visuals.Spinner(
		'Uploading source package to balena cloud',
	);
	const exitOnError = (error: Error): never => {
		uploadSpinner.stop();
		return exitWithExpectedError(error);
	};

	try {
		uploadSpinner.start();
		const builderUrl = await getBuilderEndpoint(
			build.baseUrl,
			build.owner,
			build.app,
			build.opts,
		);
		const buildRequest = createRemoteBuildRequest(
			build,
			tarStream,
			builderUrl,
			exitOnError,
		);
		return buildRequest.pipe(
			JSONStream.parse('*')
				.once('close', () => uploadSpinner.stop())
				.once('data', () => uploadSpinner.stop())
				.once('end', () => uploadSpinner.stop())
				.once('error', () => uploadSpinner.stop())
				.once('finish', () => uploadSpinner.stop()),
		);
	} catch (error) {
		return exitOnError(error);
	}
}
