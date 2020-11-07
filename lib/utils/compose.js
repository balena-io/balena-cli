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

import * as path from 'path';
import { ExpectedError } from '../errors';
import { getChalk } from './lazy';

/**
 * @returns Promise<{import('./compose-types').ComposeOpts}>
 */
export function generateOpts(options) {
	const { promises: fs } = require('fs');

	if (options.gitignore && options['multi-dockerignore']) {
		throw new ExpectedError(
			'The --gitignore and --multi-dockerignore options cannot be used together',
		);
	}
	return fs.realpath(options.source || '.').then((projectPath) => ({
		projectName: options.projectName,
		projectPath,
		inlineLogs: !options.nologs,
		convertEol: !options['noconvert-eol'],
		dockerfilePath: options.dockerfile,
		multiDockerignore: !!options['multi-dockerignore'],
		nogitignore: !options.gitignore,
		noParentCheck: options['noparent-check'],
	}));
}

// Parse the given composition and return a structure with info. Input is:
//  - composePath: the *absolute* path to the directory containing the compose file
//  - composeStr: the contents of the compose file, as a string
/**
 * @param {string} composePath
 * @param {string} composeStr
 * @param {string | null} projectName
 * @returns {import('./compose-types').ComposeProject}
 */
export function createProject(composePath, composeStr, projectName = null) {
	const yml = require('js-yaml');
	const compose = require('resin-compose-parse');

	// both methods below may throw.
	const rawComposition = yml.safeLoad(composeStr, {
		schema: yml.FAILSAFE_SCHEMA,
	});
	const composition = compose.normalize(rawComposition);

	projectName ??= path.basename(composePath);

	const descriptors = compose.parse(composition).map(function (descr) {
		// generate an image name based on the project and service names
		// if one is not given and the service requires a build
		if (
			typeof descr.image !== 'string' &&
			descr.image.context != null &&
			descr.image.tag == null
		) {
			descr.image.tag = [projectName, descr.serviceName]
				.join('_')
				.toLowerCase();
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

/**
 * This is the CLI v10 / v11 "original" tarDirectory function. It is still
 * around for the benefit of the `--gitignore` option, but is expected to be
 * deleted in CLI v13.
 * @param {string} dir Source directory
 * @param {import('./compose-types').TarDirectoryOptions} param
 * @returns {Promise<import('stream').Readable>}
 */
export async function originalTarDirectory(dir, param) {
	let {
		preFinalizeCallback = null,
		convertEol = false,
		nogitignore = false,
	} = param;
	if (convertEol == null) {
		convertEol = false;
	}

	const Bluebird = require('bluebird');
	const tar = require('tar-stream');
	const klaw = require('klaw');
	const { promises: fs } = require('fs');
	const streamToPromise = require('stream-to-promise');
	const { printGitignoreWarn } = require('./compose_ts');
	const { FileIgnorer, IgnoreFileType } = require('./ignore');
	const { toPosixPath } = require('resin-multibuild').PathUtils;
	let readFile;
	if (process.platform === 'win32') {
		const { readFileWithEolConversion } = require('./eol-conversion');
		readFile = (file) => readFileWithEolConversion(file, convertEol);
	} else {
		({ readFile } = fs);
	}

	const getFiles = () =>
		// @ts-ignore `klaw` returns a `Walker` which is close enough to a stream to work but ts complains
		Bluebird.resolve(streamToPromise(klaw(dir)))
			.filter((item) => !item.stats.isDirectory())
			.map((item) => item.path);

	const ignore = new FileIgnorer(dir);
	const pack = tar.pack();
	const ignoreFiles = {};
	return getFiles()
		.each(function (file) {
			const type = ignore.getIgnoreFileType(path.relative(dir, file));
			if (type != null) {
				ignoreFiles[type] = ignoreFiles[type] || [];
				ignoreFiles[type].push(path.resolve(dir, file));
				return ignore.addIgnoreFile(file, type);
			}
		})
		.tap(() => {
			if (!nogitignore) {
				printGitignoreWarn(
					(ignoreFiles[IgnoreFileType.DockerIgnore] || [])[0] || '',
					ignoreFiles[IgnoreFileType.GitIgnore] || [],
				);
			}
		})
		.filter(ignore.filter)
		.map(function (file) {
			const relPath = path.relative(path.resolve(dir), file);
			return Promise.all([relPath, fs.stat(file), readFile(file)]).then(
				([filename, stats, data]) =>
					pack.entry(
						{
							name: toPosixPath(filename),
							mtime: stats.mtime,
							size: stats.size,
							mode: stats.mode,
						},
						data,
					),
			);
		})
		.then(() => preFinalizeCallback?.(pack))
		.then(function () {
			pack.finalize();
			return pack;
		});
}

/**
 * @param {string} apiEndpoint
 * @param {string} auth
 * @param {number} userId
 * @param {number} appId
 * @param {import('resin-compose-parse').Composition} composition
 * @returns {Promise<import('./compose-types').Release>}
 */
export const createRelease = async function (
	apiEndpoint,
	auth,
	userId,
	appId,
	composition,
) {
	const _ = require('lodash');
	const crypto = require('crypto');
	const releaseMod = require('balena-release');

	const client = releaseMod.createClient({ apiEndpoint, auth });

	const { release, serviceImages } = await releaseMod.create({
		client,
		user: userId,
		application: appId,
		composition,
		source: 'local',
		commit: crypto.pseudoRandomBytes(16).toString('hex').toLowerCase(),
	});

	return {
		client,
		release: _.omit(release, [
			'created_at',
			'belongs_to__application',
			'is_created_by__user',
			'__metadata',
		]),
		serviceImages: _.mapValues(serviceImages, (serviceImage) =>
			_.omit(serviceImage, [
				'created_at',
				'is_a_build_of__service',
				'__metadata',
			]),
		),
	};
};

/**
 *
 * @param {import('docker-toolbelt')} docker
 * @param {Array<import('./compose-types').BuiltImage>} images
 * @param {Partial<import('balena-release/build/models').ImageModel>} serviceImages
 * @returns {Promise<Array<import('./compose-types').TaggedImage>>}
 */
export const tagServiceImages = (docker, images, serviceImages) =>
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

/**
 * @param {*} sdk
 * @param {import('docker-toolbelt')} docker
 * @param {import('./logger')} logger
 * @param {number} appID
 * @returns {Promise<string[]>}
 */
export const getPreviousRepos = (sdk, docker, logger, appID) =>
	sdk.pine
		.get({
			resource: 'release',
			options: {
				$filter: {
					belongs_to__application: appID,
					status: 'success',
				},
				$select: ['id'],
				$expand: {
					contains__image: {
						$expand: 'image',
					},
				},
				$orderby: 'id desc',
				$top: 1,
			},
		})
		.then(function (release) {
			// grab all images from the latest release, return all image locations in the registry
			if (release.length > 0) {
				const images = release[0].contains__image;
				return Promise.all(
					images.map(function (d) {
						const imageName = d.image[0].is_stored_at__image_location;
						return docker
							.getRegistryAndName(imageName)
							.then(function (registry) {
								logger.logDebug(
									`Requesting access to previously pushed image repo (${registry.imageName})`,
								);
								return registry.imageName;
							});
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

/**
 * @param {*} sdk
 * @param {string} tokenAuthEndpoint
 * @param {string} registry
 * @param {string[]} images
 * @param {string[]} previousRepos
 * @returns {Promise<string>}
 */
export const authorizePush = function (
	sdk,
	tokenAuthEndpoint,
	registry,
	images,
	previousRepos,
) {
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

/**
 * @param {import('docker-toolbelt')} docker
 * @param {string} token
 * @param {Array<import('./compose-types').TaggedImage>} images
 * @param {(serviceImage: import('balena-release/build/models').ImageModel, props: object) => void} afterEach
 */
export const pushAndUpdateServiceImages = function (
	docker,
	token,
	images,
	afterEach,
) {
	const { DockerProgress } = require('docker-progress');
	const { retry } = require('./helpers');
	const tty = require('./tty')(process.stdout);
	const Bluebird = require('bluebird');

	const opts = { authconfig: { registrytoken: token } };

	const progress = new DockerProgress({ dockerToolbelt: docker });
	const renderer = pushProgressRenderer(
		tty,
		getChalk().blue('[Push]') + '    ',
	);
	const reporters = progress.aggregateProgress(images.length, renderer);

	return Bluebird.using(tty.cursorHidden(), () =>
		Promise.all(
			images.map(({ serviceImage, localImage, props, logs }, index) =>
				Promise.all([
					localImage.inspect().then((img) => img.Size),
					retry({
						// @ts-ignore
						func: () => progress.push(localImage.name, reporters[index], opts),
						maxAttempts: 3, // try calling func 3 times (max)
						// @ts-ignore
						label: localImage.name, // label for retry log messages
						initialDelayMs: 2000, // wait 2 seconds before the 1st retry
						backoffScaler: 1.4, // wait multiplier for each retry
					}).finally(renderer.end),
				])
					.then(
						/** @type {([number, string]) => void} */
						function ([size, digest]) {
							serviceImage.image_size = size;
							serviceImage.content_hash = digest;
							serviceImage.build_log = logs;
							serviceImage.dockerfile = props.dockerfile;
							serviceImage.project_type = props.projectType;
							if (props.startTime) {
								serviceImage.start_timestamp = props.startTime;
							}
							if (props.endTime) {
								serviceImage.end_timestamp = props.endTime;
							}
							serviceImage.push_timestamp = new Date();
							serviceImage.status = 'success';
						},
					)
					.catch(function (e) {
						serviceImage.error_message = '' + e;
						serviceImage.status = 'failed';
						throw e;
					})
					.finally(() => afterEach?.(serviceImage, props)),
			),
		),
	);
};

// utilities

const renderProgressBar = function (percentage, stepCount) {
	const _ = require('lodash');
	percentage = _.clamp(percentage, 0, 100);
	const barCount = Math.floor((stepCount * percentage) / 100);
	const spaceCount = stepCount - barCount;
	const bar = `[${_.repeat('=', barCount)}>${_.repeat(' ', spaceCount)}]`;
	return `${bar} ${_.padStart(percentage, 3)}%`;
};

var pushProgressRenderer = function (tty, prefix) {
	const fn = function (e) {
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

export class BuildProgressUI {
	constructor(tty, descriptors) {
		this._handleEvent = this._handleEvent.bind(this);
		this._handleInterrupt = this._handleInterrupt.bind(this);
		this.start = this.start.bind(this);
		this.end = this.end.bind(this);
		this._display = this._display.bind(this);
		const _ = require('lodash');
		const through = require('through2');

		const eventHandler = this._handleEvent;
		const services = _.map(descriptors, 'serviceName');

		const streams = _(services)
			.map(function (service) {
				const stream = through.obj(function (event, _enc, cb) {
					eventHandler(service, event);
					return cb();
				});
				stream.pipe(tty.stream, { end: false });
				return [service, stream];
			})
			.fromPairs()
			.value();

		this._tty = tty;
		this._serviceToDataMap = {};
		this._services = services;

		// Logger magically prefixes the log line with [Build] etc., but it doesn't
		// work well with the spinner we're also showing. Manually build the prefix
		// here and bypass the logger.
		const prefix = getChalk().blue('[Build]') + '   ';

		const offset = 10; // account for escape sequences inserted for colouring
		this._prefixWidth =
			offset + prefix.length + _.max(_.map(services, 'length'));
		this._prefix = prefix;

		// these are to handle window wrapping
		this._maxLineWidth = null;
		this._lineWidths = [];

		this._startTime = null;
		this._ended = false;
		this._cancelled = false;
		this._spinner = require('./compose_ts').createSpinner();

		this.streams = streams;
	}

	_handleEvent(service, event) {
		this._serviceToDataMap[service] = event;
	}

	_handleInterrupt() {
		this._cancelled = true;
		this.end();
		return process.exit(130); // 128 + SIGINT
	}

	start() {
		process.on('SIGINT', this._handleInterrupt);
		this._tty.hideCursor();
		this._services.forEach((service) => {
			this.streams[service].write({ status: 'Preparing...' });
		});
		this._runloop = require('./compose_ts').createRunLoop(this._display);
		this._startTime = Date.now();
	}

	end(summary = null) {
		if (this._ended) {
			return;
		}
		this._ended = true;
		process.removeListener('SIGINT', this._handleInterrupt);
		this._runloop?.end();
		this._runloop = null;

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
		const _ = require('lodash');

		const services = this._services;
		const serviceToDataMap = this._serviceToDataMap;

		return _(services)
			.map(function (service) {
				const { status, progress, error } = serviceToDataMap[service] ?? {};
				if (error) {
					return `${error}`;
				} else if (progress) {
					const bar = renderProgressBar(progress, 20);
					if (status) {
						return `${bar} ${status}`;
					}
					return `${bar}`;
				} else if (status) {
					return `${status}`;
				} else {
					return 'Waiting...';
				}
			})
			.map((data, index) => [services[index], data])
			.fromPairs()
			.value();
	}

	_renderStatus(end) {
		end ??= false;

		const moment = require('moment');
		require('moment-duration-format')(moment);

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
					: moment
							.duration(
								Math.floor((Date.now() - this._startTime) / 1000),
								'seconds',
							)
							.format();
			this._tty.writeLine(`Built ${serviceStr} in ${durationStr}`);
		} else {
			this._tty.writeLine(`Building services... ${this._spinner()}`);
		}
	}

	_renderSummary(serviceToStrMap) {
		const _ = require('lodash');
		const chalk = getChalk();
		const truncate = require('cli-truncate');
		const strlen = require('string-width');

		this._services.forEach((service, index) => {
			let str = _.padEnd(this._prefix + chalk.bold(service), this._prefixWidth);
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

export class BuildProgressInline {
	constructor(outStream, descriptors) {
		this.start = this.start.bind(this);
		this.end = this.end.bind(this);
		this._renderEvent = this._renderEvent.bind(this);
		const _ = require('lodash');
		const through = require('through2');

		const services = _.map(descriptors, 'serviceName');
		const eventHandler = this._renderEvent;
		const streams = _(services)
			.map(function (service) {
				const stream = through.obj(function (event, _enc, cb) {
					eventHandler(service, event);
					return cb();
				});
				stream.pipe(outStream, { end: false });
				return [service, stream];
			})
			.fromPairs()
			.value();

		const offset = 10; // account for escape sequences inserted for colouring
		this._prefixWidth = offset + _.max(_.map(services, 'length'));
		this._outStream = outStream;
		this._services = services;
		this._startTime = null;
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

	end(summary = null) {
		const moment = require('moment');
		require('moment-duration-format')(moment);

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
				: moment
						.duration(
							Math.floor((Date.now() - this._startTime) / 1000),
							'seconds',
						)
						.format();
		this._outStream.write(`Built ${serviceStr} in ${durationStr}\n`);
	}

	_renderEvent(service, event) {
		const _ = require('lodash');

		const str = (function () {
			const { status, error } = event;
			if (error) {
				return `${error}`;
			} else if (status) {
				return `${status}`;
			} else {
				return 'Waiting...';
			}
		})();

		const prefix = _.padEnd(getChalk().bold(service), this._prefixWidth);
		this._outStream.write(prefix);
		this._outStream.write(str);
		this._outStream.write('\n');
	}
}
