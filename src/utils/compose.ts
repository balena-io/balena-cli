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

import type { Renderer } from './compose_ts.js';
import type * as SDK from 'balena-sdk';
import type * as Dockerode from 'dockerode';
import * as path from 'path';
import type { Composition, ImageDescriptor } from '@balena/compose/dist/parse/index.js';
import type { RetryParametersObj } from 'pinejs-client-core';
import type {
	BuiltImage,
	ComposeOpts,
	ComposeProject,
	Release,
	TaggedImage,
} from './compose-types';
import type Logger from './logger.js';
import type { ProgressCallback } from 'docker-progress';
import { getCliUx } from './lazy.js';
import { pick } from './helpers.js';

export function generateOpts(options: {
	source?: string;
	projectName?: string;
	nologs: boolean;
	'noconvert-eol': boolean;
	dockerfile?: string;
	'multi-dockerignore': boolean;
	'noparent-check': boolean;
}): Promise<ComposeOpts> {
	const { promises: fs } = require('fs') as typeof import('fs');
	return fs.realpath(options.source ?? '.').then((projectPath) => ({
		projectName: options.projectName,
		projectPath,
		inlineLogs: !options.nologs,
		convertEol: !options['noconvert-eol'],
		dockerfilePath: options.dockerfile,
		multiDockerignore: !!options['multi-dockerignore'],
		noParentCheck: options['noparent-check'],
	}));
}

/** Parse the given composition and return a structure with info. Input is:
 * - composePath: the *absolute* path to the directory containing the compose file
 *  - composeStr: the contents of the compose file, as a string
 */
export function createProject(
	composePath: string,
	composeStr: string,
	projectName = '',
	imageTag = '',
): ComposeProject {
	const yml = require('js-yaml') as typeof import('js-yaml');
	const compose =
		require('@balena/compose/dist/parse/index.js') as typeof import('@balena/compose/dist/parse/index.js');

	// both methods below may throw.
	const rawComposition = yml.load(composeStr);
	const composition = compose.normalize(rawComposition);

	projectName ||= path.basename(composePath);

	const descriptors = compose.parse(composition).map(function (descr) {
		// generate an image name based on the project and service names
		// if one is not given and the service requires a build
		if (
			typeof descr.image !== 'string' &&
			descr.image.context != null &&
			descr.image.tag == null
		) {
			const { makeImageName } =
				require('./compose_ts') as typeof import('./compose_ts.js');
			descr.image.tag = makeImageName(projectName, descr.serviceName, imageTag);
		}
		return descr;
	});
	return {
		path: composePath,
		name: projectName,
		composition,
		descriptors,
	};
}

const getRequestRetryParameters = (): RetryParametersObj => {
	if (
		process.env.BALENA_CLI_TEST_TYPE != null &&
		process.env.BALENA_CLI_TEST_TYPE !== ''
	) {
		// We only read the test env vars when in test mode.
		const { intVar } =
			require('@balena/env-parsing') as typeof import('@balena/env-parsing');
		// We use the BALENARCTEST namespace and only parse the env vars while in test mode
		// since we plan to switch all pinejs clients with the one of the SDK and might not
		// want to have to support these env vars.
		return {
			minDelayMs: intVar('BALENARCTEST_API_RETRY_MIN_DELAY_MS'),
			maxDelayMs: intVar('BALENARCTEST_API_RETRY_MAX_DELAY_MS'),
			maxAttempts: intVar('BALENARCTEST_API_RETRY_MAX_ATTEMPTS'),
		};
	}

	return {
		minDelayMs: 1000,
		maxDelayMs: 60000,
		maxAttempts: 7,
	};
};

export const createRelease = async function (
	sdk: SDK.BalenaSDK,
	logger: Logger,
	appId: number,
	composition: Composition,
	draft: boolean,
	semver: string | undefined,
	contract: import('@balena/compose/dist/release/models').ReleaseModel['contract'],
	imgDescriptors: ImageDescriptor[],
): Promise<Release> {
	const crypto = require('crypto') as typeof import('crypto');
	const releaseMod =
		require('@balena/compose/dist/release/index.js') as typeof import('@balena/compose/dist/release/index.js');

	const pinejsClient: import('@balena/compose').release.Request['client'] =
		sdk.pine.clone(
			{
				retry: {
					...getRequestRetryParameters(),
					onRetry: (err, delayMs, attempt, maxAttempts) => {
						const code = err?.statusCode ?? 0;
						logger.logDebug(
							`API call failed with code ${code}.  Attempting retry ${attempt} of ${maxAttempts} in ${
								delayMs / 1000
							} seconds`,
						);
					},
				},
			},
			{
				apiVersion: 'v7',
			},
		);

	const { id: userId } = await sdk.auth.getUserInfo();
	const { release, serviceImages } = await releaseMod.create({
		client: pinejsClient,
		user: userId,
		application: appId,
		composition,
		source: 'local',
		commit: crypto.pseudoRandomBytes(16).toString('hex').toLowerCase(),
		semver,
		is_final: !draft,
		contract,
		imgDescriptors,
	});

	for (const serviceImage of Object.values(serviceImages)) {
		if ('created_at' in serviceImage) {
			delete serviceImage.created_at;
		}
		if ('is_a_build_of__service' in serviceImage) {
			delete serviceImage.is_a_build_of__service;
		}
	}

	return {
		client: pinejsClient,
		release: pick(release, [
			'id',
			'status',
			'commit',
			'composition',
			'source',
			'is_final',
			'contract',
			'semver',
			'start_timestamp',
			'end_timestamp',
		]),
		serviceImages,
	};
};

export const tagServiceImages = (
	docker: Dockerode,
	images: BuiltImage[],
	serviceImages: Release['serviceImages'],
): Promise<TaggedImage[]> =>
	Promise.all(
		images.map(function (d) {
			const serviceImage = serviceImages[d.serviceName];
			const imageName = serviceImage.is_stored_at__image_location;
			const match = /(.*?)\/(.*?)(?::([^/]*))?$/.exec(imageName);
			if (match == null) {
				throw new Error(`Could not parse imageName: '${imageName}'`);
			}
			const [, registry, repo, tag = 'latest'] = match;
			const name = `${registry}/${repo}`;
			return docker
				.getImage(d.name)
				.tag({ repo: name, tag, force: true })
				.then(() => docker.getImage(`${name}:${tag}`))
				.then((localImage) => ({
					serviceName: d.serviceName,
					serviceImage,
					localImage,
					registry,
					repo,
					logs: d.logs,
					props: d.props,
				}));
		}),
	);

export const getPreviousRepos = (
	sdk: SDK.BalenaSDK,
	logger: Logger,
	appID: number,
): Promise<string[]> =>
	sdk.pine
		.get({
			resource: 'release',
			options: {
				$select: 'id',
				$filter: {
					belongs_to__application: appID,
					status: 'success',
				},
				$expand: {
					release_image: {
						$select: 'id',
						$expand: { image: { $select: 'is_stored_at__image_location' } },
					},
				},
				$orderby: { id: 'desc' },
				$top: 1,
			},
		})
		.then(function (release) {
			// grab all images from the latest release, return all image locations in the registry
			if (release.length > 0) {
				const images = release[0].release_image;
				const { getRegistryAndName } =
					require('@balena/compose/dist/multibuild/index.js') as typeof import('@balena/compose/dist/multibuild/index.js');
				return Promise.all(
					images.map(function (d) {
						const imageName = d.image[0].is_stored_at__image_location ?? '';
						const registry = getRegistryAndName(imageName);
						logger.logDebug(
							`Requesting access to previously pushed image repo (${registry.imageName})`,
						);
						return registry.imageName;
					}),
				);
			} else {
				return [];
			}
		})
		.catch((e) => {
			logger.logDebug(`Failed to access previously pushed image repo: ${e}`);
			return [];
		});

export const authorizePush = function (
	sdk: SDK.BalenaSDK,
	tokenAuthEndpoint: string,
	registry: string,
	images: string[],
	previousRepos: string[],
): Promise<string> {
	if (!Array.isArray(images)) {
		images = [images];
	}

	images.push(...previousRepos);
	return sdk.request
		.send({
			baseUrl: tokenAuthEndpoint,
			url: '/auth/v1/token',
			qs: {
				service: registry,
				scope: images.map((repo) => `repository:${repo}:pull,push`),
			},
		})
		.then(({ body }) => body.token)
		.catch(() => '');
};

// utilities

const formatDuration = (seconds: number): string => {
	const SECONDS_PER_MINUTE = 60;
	const SECONDS_PER_HOUR = 3600;

	const hours = Math.floor(seconds / SECONDS_PER_HOUR);
	seconds %= SECONDS_PER_HOUR;

	const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
	seconds = Math.floor(seconds % SECONDS_PER_MINUTE);

	return hours > 0
		? `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
		: `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const renderProgressBar = function (percentage: number, stepCount: number) {
	percentage = Math.max(Math.min(percentage, 0), 100);
	const barCount = Math.floor((stepCount * percentage) / 100);
	const spaceCount = stepCount - barCount;
	const bar = `[${'='.repeat(barCount)}>${' '.repeat(spaceCount)}]`;
	return `${bar} ${`${percentage}`.padStart(3)}%`;
};

export const pushProgressRenderer = function (
	tty: ReturnType<typeof import('./tty.js')>,
	prefix: string,
): ProgressCallback & { end: () => void } {
	const fn: ProgressCallback & { end: () => void } = function (e) {
		const { error, percentage } = e;
		if (error != null) {
			throw new Error(error);
		}
		const bar = renderProgressBar(percentage, 40);
		return tty.replaceLine(`${prefix}${bar}\r`);
	};
	fn.end = () => {
		tty.clearLine();
	};
	return fn;
};

export class BuildProgressUI implements Renderer {
	public streams;
	private _prefix;
	private _prefixWidth;
	private _tty;
	private _services;
	private _startTime: undefined | number;
	private _ended;
	private _serviceToDataMap: Dictionary<{
		status?: string;
		progress?: number;
		error?: Error;
	}> = {};
	private _cancelled;
	private _spinner;
	private _runloop:
		| undefined
		| ReturnType<typeof import('./compose_ts.js').createRunLoop>;

	// these are to handle window wrapping
	private _maxLineWidth: undefined | number;
	private _lineWidths: number[] = [];

	constructor(
		tty: ReturnType<typeof import('./tty.js')>,
		descriptors: ImageDescriptor[],
	) {
		this._handleEvent = this._handleEvent.bind(this);
		this.start = this.start.bind(this);
		this.end = this.end.bind(this);
		this._display = this._display.bind(this);
		const through = require('through2') as typeof import('through2');

		const eventHandler = this._handleEvent;
		const services = descriptors.map((d) => d.serviceName);

		const streams = Object.fromEntries(
			services.map(function (service) {
				const stream = through.obj(function (event, _enc, cb) {
					eventHandler(service, event);
					cb();
				});
				stream.pipe(tty.stream, { end: false });
				return [service, stream];
			}),
		);

		this._tty = tty;
		this._services = services;

		const ux = getCliUx();
		// Logger magically prefixes the log line with [Build] etc., but it doesn't
		// work well with the spinner we're also showing. Manually build the prefix
		// here and bypass the logger.
		const prefix = ux.colorize('blue', '[Build]') + '   ';

		const offset = 10; // account for escape sequences inserted for colouring
		this._prefixWidth =
			offset + prefix.length + Math.max(...services.map((s) => s.length));
		this._prefix = prefix;

		this._ended = false;
		this._cancelled = false;
		this._spinner = (
			require('./compose_ts') as typeof import('./compose_ts.js')
		).createSpinner();

		this.streams = streams;
	}

	_handleEvent(
		service: string,
		event: { status?: string; progress?: number; error?: Error },
	) {
		this._serviceToDataMap[service] = event;
	}

	start() {
		this._tty.hideCursor();
		this._services.forEach((service) => {
			this.streams[service].write({ status: 'Preparing...' });
		});
		this._runloop = (
			require('./compose_ts') as typeof import('./compose_ts.js')
		).createRunLoop(this._display);
		this._startTime = Date.now();
	}

	end(summary?: Dictionary<string>) {
		if (this._ended) {
			return;
		}
		this._ended = true;
		this._runloop?.end();
		this._runloop = undefined;

		this._clear();
		this._renderStatus(true);
		this._renderSummary(summary ?? this._getServiceSummary());
		this._tty.showCursor();
	}

	_display() {
		this._clear();
		this._renderStatus();
		this._renderSummary(this._getServiceSummary());
		this._tty.cursorUp(this._services.length + 1); // for status line
	}

	_clear() {
		this._tty.deleteToEnd();
		this._maxLineWidth = this._tty.currentWindowSize().width;
	}

	_getServiceSummary() {
		const _ = require('lodash') as typeof import('lodash');

		const services = this._services;
		const serviceToDataMap = this._serviceToDataMap;

		return _(services)
			.map(function (service) {
				const { status, progress, error } = serviceToDataMap[service] ?? {};
				if (error) {
					return `${error}`;
				}

				if (progress) {
					const bar = renderProgressBar(progress, 20);
					if (status) {
						return `${bar} ${status}`;
					}
					return bar;
				}

				if (status) {
					return status;
				}
				return 'Waiting...';
			})
			.map((data, index) => [services[index], data])
			.fromPairs()
			.value();
	}

	_renderStatus(end = false) {
		this._tty.clearLine();
		this._tty.write(this._prefix);
		if (end && this._cancelled) {
			this._tty.writeLine('Build cancelled');
		} else if (end) {
			const serviceCount = this._services.length;
			const serviceStr =
				serviceCount === 1 ? '1 service' : `${serviceCount} services`;
			const durationStr =
				this._startTime == null
					? 'unknown time'
					: formatDuration((Date.now() - this._startTime) / 1000);

			this._tty.writeLine(`Built ${serviceStr} in ${durationStr}`);
		} else {
			this._tty.writeLine(`Building services... ${this._spinner()}`);
		}
	}

	_renderSummary(serviceToStrMap: Dictionary<string>) {
		const truncate = require('cli-truncate') as typeof import('cli-truncate');
		const strlen = require('string-width') as typeof import('string-width');
		const ux = getCliUx();

		this._services.forEach((service, index) => {
			let str = (this._prefix + ux.colorize('bold', service)).padEnd(
				this._prefixWidth,
			);
			str += serviceToStrMap[service];
			if (this._maxLineWidth != null) {
				str = truncate(str, this._maxLineWidth);
			}
			this._lineWidths[index] = strlen(str);

			this._tty.clearLine();
			this._tty.writeLine(str);
		});
	}
}

export class BuildProgressInline implements Renderer {
	public streams;
	private _prefixWidth;
	private _outStream;
	private _services;
	private _startTime: number | undefined;
	private _ended;

	constructor(
		outStream: NodeJS.ReadWriteStream,
		descriptors: Array<{ serviceName: string }>,
	) {
		this.start = this.start.bind(this);
		this.end = this.end.bind(this);
		this._renderEvent = this._renderEvent.bind(this);
		const through = require('through2') as typeof import('through2');

		const services = descriptors.map((d) => d.serviceName);
		const eventHandler = this._renderEvent;
		const streams = Object.fromEntries(
			services.map(function (service) {
				const stream = through.obj(function (event, _enc, cb) {
					eventHandler(service, event);
					cb();
				});
				stream.pipe(outStream, { end: false });
				return [service, stream];
			}),
		);

		const offset = 10; // account for escape sequences inserted for colouring
		this._prefixWidth = offset + Math.max(...services.map((s) => s.length));
		this._outStream = outStream;
		this._services = services;
		this._ended = false;

		this.streams = streams;
	}

	start() {
		this._outStream.write('Building services...\n');
		this._services.forEach((service) => {
			this.streams[service].write({ status: 'Preparing...' });
		});
		this._startTime = Date.now();
	}

	end(summary?: Dictionary<string>) {
		if (this._ended) {
			return;
		}
		this._ended = true;

		if (summary != null) {
			this._services.forEach((service) => {
				this._renderEvent(service, { status: summary[service] });
			});
		}

		const serviceCount = this._services.length;
		const serviceStr =
			serviceCount === 1 ? '1 service' : `${serviceCount} services`;
		const durationStr =
			this._startTime == null
				? 'unknown time'
				: formatDuration((Date.now() - this._startTime) / 1000);
		this._outStream.write(`Built ${serviceStr} in ${durationStr}\n`);
	}

	_renderEvent(service: string, event: { status?: string; error?: Error }) {
		const ux = getCliUx();

		const str = (function () {
			const { status, error } = event;
			if (error) {
				return `${error}`;
			}
			if (status) {
				return status;
			}
			return 'Waiting...';
		})();

		const prefix = ux.colorize('bold', service).padEnd(this._prefixWidth);
		this._outStream.write(prefix);
		this._outStream.write(str);
		this._outStream.write('\n');
	}
}
