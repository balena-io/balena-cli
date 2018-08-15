/*
Copyright 2016-2017 Resin.io

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

import * as JSONStream from 'JSONStream';
import * as request from 'request';
import { ResinSDK } from 'resin-sdk';
import * as Stream from 'stream';

import { tarDirectory } from './compose';

const DEBUG_MODE = !!process.env.DEBUG;

const CURSOR_METADATA_REGEX = /([a-z]+)([0-9]+)?/;
const TRIM_REGEX = /\n+$/;

export interface BuildOpts {
	emulated: boolean;
	nocache: boolean;
}

export interface RemoteBuild {
	app: string;
	owner: string;
	source: string;
	auth: string;
	baseUrl: string;
	opts: BuildOpts;

	sdk: ResinSDK;

	// For internal use
	releaseId?: number;
}

interface BuilderMessage {
	message: string;
	type?: string;
	replace?: boolean;
	// These will be set when the type === 'metadata'
	resource?: string;
	value?: string;
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
		emulated: opts.emulated,
		nocache: opts.nocache,
	});
	return `https://builder.${baseUrl}/v3/build?${args}`;
}

export async function startRemoteBuild(build: RemoteBuild): Promise<void> {
	const Bluebird = await import('bluebird');

	const stream = await getRequestStream(build);

	// Special windows handling (win64 also reports win32)
	if (process.platform === 'win32') {
		const readline = (await import('readline')).createInterface({
			input: process.stdin,
			output: process.stdout,
		});

		readline.on('SIGINT', () => process.emit('SIGINT'));
	}

	return new Bluebird((resolve, reject) => {
		// Setup interrupt handlers so we can cancel the build if the user presses
		// ctrl+c

		// This is necessary because the `exit-hook` module is used by several
		// dependencies, and will exit without calling the following handler.
		// Once https://github.com/resin-io/resin-cli/issues/867 has been solved,
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
	}).return();
}

async function handleBuilderMetadata(obj: BuilderMessage, build: RemoteBuild) {
	const { stripIndent } = await import('common-tags');

	switch (obj.resource) {
		case 'cursor':
			const readline = await import('readline');

			if (obj.value == null) {
				return;
			}

			const match = obj.value.match(CURSOR_METADATA_REGEX);

			if (!match) {
				// FIXME: Make this error nicer.
				console.log(
					stripIndent`
					Warning: ignoring unknown builder command. You may experience
					odd build output. Maybe you need to update resin-cli?`,
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
): (obj: BuilderMessage) => Promise<void> {
	return async (obj: BuilderMessage) => {
		if (DEBUG_MODE) {
			console.log(`[debug] handling message: ${JSON.stringify(obj)}`);
		}
		if (obj.type != null && obj.type === 'metadata') {
			return handleBuilderMetadata(obj, build);
		}
		if (obj.message) {
			const readline = await import('readline');
			readline.clearLine(process.stdout, 0);

			const message = obj.message.replace(TRIM_REGEX, '');
			if (obj.replace) {
				process.stdout.write(`\r${message}`);
			} else {
				process.stdout.write(`\r${message}\n`);
			}
		}
	};
}

async function cancelBuildIfNecessary(build: RemoteBuild): Promise<void> {
	if (build.releaseId != null) {
		await build.sdk.pine.patch({
			resource: 'release',
			id: build.releaseId,
			body: {
				status: 'cancelled',
				end_timestamp: Date.now(),
			},
		});
	}
}

async function getRequestStream(build: RemoteBuild): Promise<Stream.Duplex> {
	const path = await import('path');
	const visuals = await import('resin-cli-visuals');

	const tarSpinner = new visuals.Spinner('Packaging the project source...');
	tarSpinner.start();
	// Tar the directory so that we can send it to the builder
	const tarStream = await tarDirectory(path.resolve(build.source));
	tarSpinner.stop();

	if (DEBUG_MODE) {
		console.log('[debug] Opening builder connection');
	}
	const post = request.post({
		url: await getBuilderEndpoint(
			build.baseUrl,
			build.owner,
			build.app,
			build.opts,
		),
		auth: {
			bearer: build.auth,
		},
	});

	const uploadSpinner = new visuals.Spinner(
		'Uploading source package to resin cloud',
	);
	uploadSpinner.start();

	tarStream.pipe(post);

	const parseStream = post.pipe(JSONStream.parse('*'));
	parseStream.on('data', () => uploadSpinner.stop());
	return parseStream as Stream.Duplex;
}
