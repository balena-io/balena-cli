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

import * as Bluebird from 'bluebird';
import * as path from 'path';

import { ExpectedError } from '../errors';
import { getChalk, stripIndent } from './lazy';

export const appendProjectOptions = (opts) =>
	opts.concat([
		{
			signature: 'projectName',
			parameter: 'projectName',
			description:
				'Specify an alternate project name; default is the directory name',
			alias: 'n',
		},
	]);

export function appendOptions(opts) {
	const { isV12 } = require('./version');
	return appendProjectOptions(opts).concat([
		{
			signature: 'emulated',
			description: 'Run an emulated build using Qemu',
			boolean: true,
			alias: 'e',
		},
		{
			signature: 'dockerfile',
			parameter: 'Dockerfile',
			description:
				'Alternative Dockerfile name/path, relative to the source folder',
		},
		{
			signature: 'logs',
			description: isV12()
				? 'No-op and deprecated since balena CLI v12.0.0. Build logs are now shown by default.'
				: 'Display full log output',
			boolean: true,
		},
		...(isV12()
			? [
					{
						signature: 'nologs',
						description:
							'Hide the image build log output (produce less verbose output)',
						boolean: true,
					},
			  ]
			: []),
		{
			signature: 'gitignore',
			alias: 'g',
			description: stripIndent`
				Consider .gitignore files in addition to the .dockerignore file. This reverts
				to the CLI v11 behavior/implementation (deprecated) if compatibility is required
				until your project can be adapted.`,
			boolean: true,
		},
		{
			signature: 'multi-dockerignore',
			alias: 'm',
			description:
				'Have each service use its own .dockerignore file. See "balena help build".',
			boolean: true,
		},
		{
			signature: 'nogitignore',
			description: `No-op (default behavior) since balena CLI v12.0.0. See "balena help build".`,
			boolean: true,
			alias: 'G',
		},
		{
			signature: 'noparent-check',
			description:
				"Disable project validation check of 'docker-compose.yml' file in parent folder",
			boolean: true,
		},
		{
			signature: 'registry-secrets',
			alias: 'R',
			parameter: 'secrets.yml|.json',
			description:
				'Path to a YAML or JSON file with passwords for a private Docker registry',
		},
		{
			signature: 'convert-eol',
			description: isV12()
				? 'No-op and deprecated since balena CLI v12.0.0'
				: `\
On Windows only, convert line endings from CRLF (Windows format) to LF (Unix format). \
Source files are not modified.`,
			boolean: true,
			alias: 'l',
		},
		...(isV12()
			? [
					{
						signature: 'noconvert-eol',
						description:
							"Don't convert line endings from CRLF (Windows format) to LF (Unix format).",
						boolean: true,
					},
			  ]
			: []),
	]);
}

/**
 * @returns Promise<{import('./compose-types').ComposeOpts}>
 */
export function generateOpts(options) {
	const { promises: fs } = require('fs');
	const { isV12 } = require('./version');

	if (options.gitignore && options['multi-dockerignore']) {
		throw new ExpectedError(
			'The --gitignore and --multi-dockerignore options cannot be used together',
		);
	}
	return fs.realpath(options.source || '.').then((projectPath) => ({
		projectName: options.projectName,
		projectPath,
		inlineLogs: !options.nologs && (!!options.logs || isV12()),
		convertEol: isV12() ? !options['noconvert-eol'] : !!options['convert-eol'],
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

	if (projectName == null) {
		projectName = path.basename(composePath);
	}
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
 * Create a tar stream out of the local filesystem at the given directory,
 * while optionally applying file filters such as '.dockerignore' and
 * optionally converting text file line endings (CRLF to LF).
 * @param {string} dir Source directory
 * @param {import('./compose-types').TarDirectoryOptions} param
 * @returns {Bluebird<import('stream').Readable>}
 */
export function tarDirectory(dir, param) {
	let { nogitignore = false } = param;
	if (nogitignore) {
		return Bluebird.resolve(require('./compose_ts').tarDirectory(dir, param));
	} else {
		return originalTarDirectory(dir, param);
	}
}

/**
 * This is the CLI v10 / v11 "original" tarDirectory function. It is still
 * around for the benefit of the `--gitignore` option, but is expected to be
 * deleted in CLI v13.
 * @param {string} dir Source directory
 * @param {import('./compose-types').TarDirectoryOptions} param
 * @returns {Bluebird<import('stream').Readable>}
 */
function originalTarDirectory(dir, param) {
	let {
		preFinalizeCallback = null,
		convertEol = false,
		nogitignore = false,
	} = param;
	if (convertEol == null) {
		convertEol = false;
	}

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
			return Bluebird.join(
				relPath,
				fs.stat(file),
				readFile(file),
				(filename, stats, data) =>
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
 * @param {string} str
 * @param {number} len
 * @returns {string}
 */
const truncateString = function (str, len) {
	if (str.length < len) {
		return str;
	}
	str = str.slice(0, len);
	// return everything up to the last line. this is a cheeky way to avoid
	// having to deal with splitting the string midway through some special
	// character sequence.
	return str.slice(0, str.lastIndexOf('\n'));
};

const LOG_LENGTH_MAX = 512 * 1024; // 512KB

export function buildProject(
	docker,
	logger,
	projectPath,
	projectName,
	composition,
	arch,
	deviceType,
	emulated,
	buildOpts,
	inlineLogs,
	convertEol,
	dockerfilePath,
	nogitignore,
	multiDockerignore,
) {
	const _ = require('lodash');
	const humanize = require('humanize');
	const compose = require('resin-compose-parse');
	const builder = require('resin-multibuild');
	const transpose = require('docker-qemu-transpose');
	const { BALENA_ENGINE_TMP_PATH } = require('../config');
	const {
		checkBuildSecretsRequirements,
		makeBuildTasks,
	} = require('./compose_ts');
	const qemu = require('./qemu');
	const { toPosixPath } = builder.PathUtils;

	logger.logInfo(`Building for ${arch}/${deviceType}`);

	const imageDescriptors = compose.parse(composition);
	const imageDescriptorsByServiceName = _.keyBy(
		imageDescriptors,
		'serviceName',
	);

	let renderer;
	if (inlineLogs) {
		renderer = new BuildProgressInline(
			logger.streams['build'],
			imageDescriptors,
		);
	} else {
		const tty = require('./tty')(process.stdout);
		renderer = new BuildProgressUI(tty, imageDescriptors);
	}
	renderer.start();

	return Bluebird.resolve(checkBuildSecretsRequirements(docker, projectPath))
		.then(() => qemu.installQemuIfNeeded(emulated, logger, arch, docker))
		.tap(function (needsQemu) {
			if (!needsQemu) {
				return;
			}
			logger.logInfo('Emulation is enabled');
			// Copy qemu into all build contexts
			return Bluebird.map(imageDescriptors, function (d) {
				if (typeof d.image === 'string' || d.image.context == null) {
					return;
				}
				// external image
				return qemu.copyQemu(path.join(projectPath, d.image.context), arch);
			});
		})
		.then((
			needsQemu, // Tar up the directory, ready for the build stream
		) =>
			tarDirectory(projectPath, {
				composition,
				convertEol,
				multiDockerignore,
				nogitignore,
			})
				.then((tarStream) =>
					makeBuildTasks(
						composition,
						tarStream,
						{ arch, deviceType },
						logger,
						projectName,
					),
				)
				.map(function (/** @type {any} */ task) {
					const d = imageDescriptorsByServiceName[task.serviceName];

					// multibuild parses the composition internally so any tags we've
					// set before are lost; re-assign them here
					if (task.tag == null) {
						task.tag = [projectName, task.serviceName].join('_').toLowerCase();
					}
					if (typeof d.image !== 'string' && d.image.context != null) {
						d.image.tag = task.tag;
					}

					// configure build opts appropriately
					if (task.dockerOpts == null) {
						task.dockerOpts = {};
					}
					_.merge(task.dockerOpts, buildOpts, { t: task.tag });
					if (typeof d.image !== 'string') {
						/** @type {any} */
						const context = d.image.context;
						if (context?.args != null) {
							if (task.dockerOpts.buildargs == null) {
								task.dockerOpts.buildargs = {};
							}
							_.merge(task.dockerOpts.buildargs, context.args);
						}
					}

					// Get the service-specific log stream
					// Caveat: `multibuild.BuildTask` defines no `logStream` property
					// but it's convenient to store it there; it's JS ultimately.
					task.logStream = renderer.streams[task.serviceName];
					task.logBuffer = [];

					// Setup emulation if needed
					if (task.external || !needsQemu) {
						return [task, null];
					}
					const binPath = qemu.qemuPathInContext(
						path.join(projectPath, task.context ?? ''),
					);
					if (task.buildStream == null) {
						throw new Error(`No buildStream for task '${task.tag}'`);
					}
					return transpose
						.transposeTarStream(
							task.buildStream,
							{
								hostQemuPath: toPosixPath(binPath),
								containerQemuPath: `/tmp/${qemu.QEMU_BIN_NAME}`,
								qemuFileMode: 0o555,
							},
							dockerfilePath || undefined,
						)
						.then((/** @type {any} */ stream) => {
							task.buildStream = stream;
						})
						.return([task, binPath]);
				}),
		)
		.map(function ([task, qemuPath]) {
			const captureStream = buildLogCapture(task.external, task.logBuffer);

			if (task.external) {
				// External image -- there's no build to be performed,
				// just follow pull progress.
				captureStream.pipe(task.logStream);
				task.progressHook = pullProgressAdapter(captureStream);
			} else {
				task.streamHook = function (stream) {
					let rawStream;
					stream = createLogStream(stream);
					if (qemuPath != null) {
						const buildThroughStream = transpose.getBuildThroughStream({
							hostQemuPath: toPosixPath(qemuPath),
							containerQemuPath: `/tmp/${qemu.QEMU_BIN_NAME}`,
						});
						rawStream = stream.pipe(buildThroughStream);
					} else {
						rawStream = stream;
					}
					// `stream` sends out raw strings in contrast to `task.progressHook`
					// where we're given objects. capture these strings as they come
					// before we parse them.
					return rawStream
						.pipe(dropEmptyLinesStream())
						.pipe(captureStream)
						.pipe(buildProgressAdapter(inlineLogs))
						.pipe(task.logStream);
				};
			}
			return task;
		})
		.then(function (tasks) {
			logger.logDebug('Prepared tasks; building...');
			return Bluebird.map(
				builder.performBuilds(tasks, docker, BALENA_ENGINE_TMP_PATH),
				function (builtImage) {
					if (!builtImage.successful) {
						/** @type {Error & {serviceName?: string}} */
						const error = builtImage.error ?? new Error();
						error.serviceName = builtImage.serviceName;
						throw error;
					}

					const d = imageDescriptorsByServiceName[builtImage.serviceName];
					const task = _.find(tasks, { serviceName: builtImage.serviceName });

					const image = {
						serviceName: d.serviceName,
						name: typeof d.image === 'string' ? d.image : d.image.tag,
						logs: truncateString(task.logBuffer.join('\n'), LOG_LENGTH_MAX),
						props: {
							dockerfile: builtImage.dockerfile,
							projectType: builtImage.projectType,
						},
					};

					// Times here are timestamps, so test whether they're null
					// before creating a date out of them, as `new Date(null)`
					// creates a date representing UNIX time 0.
					if (builtImage.startTime) {
						image.props.startTime = new Date(builtImage.startTime);
					}
					if (builtImage.endTime) {
						image.props.endTime = new Date(builtImage.endTime);
					}
					return docker
						.getImage(image.name)
						.inspect()
						.get('Size')
						.then((size) => {
							image.props.size = size;
						})
						.return(image);
				},
			).tap(function (images) {
				const summary = _(images)
					.map(({ serviceName, props }) => [
						serviceName,
						`Image size: ${humanize.filesize(props.size)}`,
					])
					.fromPairs()
					.value();
				renderer.end(summary);
			});
		})
		.finally(renderer.end);
}

/**
 * @param {string} apiEndpoint
 * @param {string} auth
 * @param {number} userId
 * @param {number} appId
 * @param {import('resin-compose-parse').Composition} composition
 * @returns {Bluebird<import('./compose-types').Release>}
 */
export const createRelease = function (
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

	return releaseMod
		.create({
			client,
			user: userId,
			application: appId,
			composition,
			source: 'local',
			commit: crypto.pseudoRandomBytes(16).toString('hex').toLowerCase(),
		})
		.then(function ({ release, serviceImages }) {
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
		});
};

/**
 *
 * @param {import('docker-toolbelt')} docker
 * @param {Array<import('./compose-types').BuiltImage>} images
 * @param {Partial<import('balena-release/build/models').ImageModel>} serviceImages
 * @returns {Bluebird<Array<import('./compose-types').TaggedImage>>}
 */
export const tagServiceImages = (docker, images, serviceImages) =>
	Bluebird.map(images, function (d) {
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
	});

/**
 * @param {*} sdk
 * @param {import('docker-toolbelt')} docker
 * @param {import('./logger')} logger
 * @param {number} appID
 * @returns {Bluebird<string[]>}
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
				return Bluebird.map(images, function (d) {
					const imageName = d.image[0].is_stored_at__image_location;
					return docker.getRegistryAndName(imageName).then(function (registry) {
						logger.logDebug(
							`Requesting access to previously pushed image repo (${registry.imageName})`,
						);
						return registry.imageName;
					});
				});
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
 * @returns {Bluebird<string>}
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
		.get('body')
		.get('token')
		.catchReturn('');
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

	const opts = { authconfig: { registrytoken: token } };

	const progress = new DockerProgress({ dockerToolbelt: docker });
	const renderer = pushProgressRenderer(
		tty,
		getChalk().blue('[Push]') + '    ',
	);
	const reporters = progress.aggregateProgress(images.length, renderer);

	return Bluebird.using(tty.cursorHidden(), () =>
		Bluebird.map(images, ({ serviceImage, localImage, props, logs }, index) =>
			Bluebird.join(
				// @ts-ignore
				localImage.inspect().get('Size'),
				retry(
					// @ts-ignore
					() => progress.push(localImage.name, reporters[index], opts),
					3, // `times` - retry 3 times
					// @ts-ignore
					localImage.name, // `label` included in retry log messages
					2000, // `delayMs` - wait 2 seconds before the 1st retry
					1.4, // `backoffScaler` - wait multiplier for each retry
				).finally(renderer.end),
				/** @type {(size: number, digest: string) => void} */
				function (size, digest) {
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
				.tapCatch(function (e) {
					serviceImage.error_message = '' + e;
					serviceImage.status = 'failed';
				})
				.finally(() => afterEach?.(serviceImage, props)),
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

var createLogStream = function (input) {
	const split = require('split');
	const stripAnsi = require('strip-ansi-stream');
	return input.pipe(stripAnsi()).pipe(split());
};

var dropEmptyLinesStream = function () {
	const through = require('through2');
	return through(function (data, _enc, cb) {
		const str = data.toString('utf-8');
		if (str.trim()) {
			this.push(str);
		}
		return cb();
	});
};

var buildLogCapture = function (objectMode, buffer) {
	const through = require('through2');

	return through({ objectMode }, function (data, _enc, cb) {
		// data from pull stream
		if (data.error) {
			buffer.push(`${data.error}`);
		} else if (data.progress && data.status) {
			buffer.push(`${data.progress}% ${data.status}`);
		} else if (data.status) {
			buffer.push(`${data.status}`);

			// data from build stream
		} else {
			buffer.push(data);
		}

		return cb(null, data);
	});
};

var buildProgressAdapter = function (inline) {
	const through = require('through2');

	const stepRegex = /^\s*Step\s+(\d+)\/(\d+)\s*: (.+)$/;

	let step = null;
	let numSteps = null;
	let progress;

	return through({ objectMode: true }, function (str, _enc, cb) {
		if (str == null) {
			return cb(null, str);
		}

		if (inline) {
			return cb(null, { status: str });
		}

		if (/^Successfully tagged /.test(str)) {
			progress = undefined;
		} else {
			const match = stepRegex.exec(str);
			if (match) {
				step = match[1];
				if (numSteps == null) {
					numSteps = match[2];
				}
				str = match[3];
			}
			if (step != null) {
				str = `Step ${step}/${numSteps}: ${str}`;
				progress = Math.floor(
					(parseInt(step, 10) * 100) / parseInt(numSteps, 10),
				);
			}
		}

		return cb(null, { status: str, progress });
	});
};

var pullProgressAdapter = (outStream) =>
	function ({ status, id, percentage, error, errorDetail }) {
		if (status != null) {
			status = status.replace(/^Status: /, '');
		}
		if (id != null) {
			status = `${id}: ${status}`;
		}
		if (percentage === 100) {
			percentage = undefined;
		}
		return outStream.write({
			status,
			progress: percentage,
			error: errorDetail?.message ?? error,
		});
	};

class BuildProgressUI {
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
		if (end == null) {
			end = false;
		}
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

class BuildProgressInline {
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
				this._renderEvent(service, summary[service]);
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
