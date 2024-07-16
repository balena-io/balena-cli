/**
 * @license
 * Copyright 2018-2021 Balena Ltd.
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
import { Flags } from '@oclif/core';
import type { BalenaSDK } from 'balena-sdk';
import type { TransposeOptions } from '@balena/compose/dist/emulate';
import type * as Dockerode from 'dockerode';
import { promises as fs } from 'fs';
import jsyaml = require('js-yaml');
import _ from 'lodash';
import * as path from 'path';
import type {
	BuildConfig,
	Composition,
	ImageDescriptor,
} from '@balena/compose/dist/parse';
import type * as MultiBuild from '@balena/compose/dist/multibuild';
import * as semver from 'semver';
import type { Duplex, Readable } from 'stream';
import type { Pack } from 'tar-stream';
import { ExpectedError } from '../errors.js';
import type {
	BuiltImage,
	ComposeOpts,
	ComposeProject,
	TaggedImage,
	TarDirectoryOptions,
} from './compose-types.js';
import type { DeviceInfo } from './device/api.js';
import { getBalenaSdk, getChalk, stripIndent } from './lazy.js';
import Logger from './logger.js';
import { exists } from './which.js';

// TODO: fix typings on balena-model
import type {
	ImageModel,
	ReleaseModel,
} from '@balena/compose/dist/release/models.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const allowedContractTypes = ['sw.application', 'sw.block'];

/**
 * Given an array representing the raw `--release-tag` flag of the deploy and
 * push commands, parse it into separate arrays of release tag keys and values.
 * The returned keys and values arrays are guaranteed to be of the same length.
 */
export function parseReleaseTagKeysAndValues(releaseTags: string[]): {
	releaseTagKeys: string[];
	releaseTagValues: string[];
} {
	if (releaseTags.length === 0) {
		return { releaseTagKeys: [], releaseTagValues: [] };
	}

	const releaseTagKeys = releaseTags.filter((_v, i) => i % 2 === 0);
	const releaseTagValues = releaseTags.filter((_v, i) => i % 2 === 1);

	releaseTagKeys.forEach((key: string) => {
		if (key === '') {
			throw new ExpectedError(`Error: --release-tag keys cannot be empty`);
		}
		if (/\s/.test(key)) {
			throw new ExpectedError(
				`Error: --release-tag keys cannot contain whitespaces`,
			);
		}
	});
	if (releaseTagKeys.length !== releaseTagValues.length) {
		releaseTagValues.push('');
	}
	return { releaseTagKeys, releaseTagValues };
}

/**
 * Use the balena SDK `models.release.tags.set()` method to set release tags
 * for the given release ID. The releaseTagKeys and releaseTagValues arrays
 * must be of the same length; their items map 1-to-1 to form key-value pairs.
 */
export async function applyReleaseTagKeysAndValues(
	sdk: BalenaSDK,
	releaseId: number,
	releaseTagKeys: string[],
	releaseTagValues: string[],
) {
	if (releaseTagKeys.length === 0) {
		return;
	}
	await Promise.all(
		(_.zip(releaseTagKeys, releaseTagValues) as Array<[string, string]>).map(
			async ([key, value]) => {
				await sdk.models.release.tags.set(releaseId, key, value);
			},
		),
	);
}

const LOG_LENGTH_MAX = 512 * 1024; // 512KB
const compositionFileNames = ['docker-compose.yml', 'docker-compose.yaml'];

/**
 * high-level function resolving a project and creating a composition out
 * of it in one go. if image is given, it'll create a default project for
 * that without looking for a project. falls back to creating a default
 * project if none is found at the given projectPath.
 */
export async function loadProject(
	logger: Logger,
	opts: ComposeOpts,
	image?: string,
	imageTag?: string,
): Promise<ComposeProject> {
	const compose = await import('@balena/compose/dist/parse');
	const { createProject } = await import('./compose.js');
	let composeName: string;
	let composeStr: string;

	logger.logDebug('Loading project...');

	if (image) {
		logger.logInfo(`Creating default composition with image: "${image}"`);
		composeStr = compose.defaultComposition(image);
	} else {
		logger.logDebug('Resolving project...');
		[composeName, composeStr] = await resolveProject(logger, opts.projectPath);

		if (composeName) {
			if (opts.dockerfilePath) {
				logger.logWarn(
					`Ignoring alternative dockerfile "${opts.dockerfilePath}" because composition file "${composeName}" exists`,
				);
			}
		} else {
			logger.logInfo(
				`Creating default composition with source: "${opts.projectPath}"`,
			);
			composeStr = compose.defaultComposition(undefined, opts.dockerfilePath);
		}

		// If local push, merge dev compose overlay
		if (opts.isLocal) {
			composeStr = await mergeDevComposeOverlay(
				logger,
				composeStr,
				opts.projectPath,
			);
		}
	}
	logger.logDebug('Creating project...');
	return createProject(
		opts.projectPath,
		composeStr,
		opts.projectName,
		imageTag,
	);
}

/**
 * Check for existence of docker-compose dev overlay file
 * and merge in services definitions.
 */
async function mergeDevComposeOverlay(
	logger: Logger,
	composeStr: string,
	projectRoot: string,
) {
	const devOverlayFilename = 'docker-compose.dev.yml';
	const devOverlayPath = path.join(projectRoot, devOverlayFilename);

	if (await exists(devOverlayPath)) {
		logger.logInfo(
			`Docker compose dev overlay detected (${devOverlayFilename}) - merging.`,
		);
		interface ComposeObj {
			services?: object;
		}
		const yaml = await import('js-yaml');
		const loadObj = (inputStr: string): ComposeObj =>
			(yaml.load(inputStr) || {}) as ComposeObj;
		try {
			const compose = loadObj(composeStr);
			const devOverlay = loadObj(await fs.readFile(devOverlayPath, 'utf8'));
			// We only want to merge the services section
			compose.services = { ...compose.services, ...devOverlay.services };
			composeStr = yaml.dump(compose, { styles: { '!!null': 'empty' } });
		} catch (err) {
			err.message = `Error merging docker compose dev overlay file "${devOverlayPath}":\n${err.message}`;
			throw err;
		}
	}

	return composeStr;
}

/**
 * Look into the given directory for valid compose files and return
 * the contents of the first one found.
 */
async function resolveProject(
	logger: Logger,
	projectRoot: string,
	quiet = false,
): Promise<[string, string]> {
	let composeFileName = '';
	let composeFileContents = '';
	for (const fname of compositionFileNames) {
		const fpath = path.join(projectRoot, fname);
		if (await exists(fpath)) {
			logger.logDebug(`${fname} file found at "${projectRoot}"`);
			composeFileName = fname;
			try {
				composeFileContents = await fs.readFile(fpath, 'utf8');
			} catch (err) {
				logger.logError(`Error reading composition file "${fpath}":\n${err}`);
				throw err;
			}
			break;
		}
	}
	if (!quiet && !composeFileName) {
		logger.logInfo(`No "docker-compose.yml" file found at "${projectRoot}"`);
	}

	return [composeFileName, composeFileContents];
}

interface BuildTaskPlus extends MultiBuild.BuildTask {
	logBuffer?: string[];
}

export interface Renderer {
	start: () => void;
	end: (buildSummaryByService?: Dictionary<string>) => void;
	streams: Dictionary<NodeJS.ReadWriteStream>;
}

export interface BuildProjectOpts {
	docker: Dockerode;
	logger: Logger;
	projectPath: string;
	projectName: string;
	composition: Composition;
	arch: string;
	deviceType: string;
	emulated: boolean;
	buildOpts: import('./docker.js').BuildOpts;
	inlineLogs?: boolean;
	convertEol: boolean;
	dockerfilePath?: string;
	multiDockerignore: boolean;
}

export async function buildProject(
	opts: BuildProjectOpts,
): Promise<BuiltImage[]> {
	await checkBuildSecretsRequirements(opts.docker, opts.projectPath);
	const compose = await import('@balena/compose/dist/parse');
	const imageDescriptors = compose.parse(opts.composition);
	const renderer = await startRenderer({ imageDescriptors, ...opts });
	let buildSummaryByService: Dictionary<string> | undefined;
	try {
		const { awaitInterruptibleTask } = await import('./helpers.js');
		const [images, summaryMsgByService] = await awaitInterruptibleTask(
			$buildProject,
			imageDescriptors,
			renderer,
			opts,
		);
		buildSummaryByService = summaryMsgByService;
		return images;
	} finally {
		renderer.end(buildSummaryByService);
	}
}

async function $buildProject(
	imageDescriptors: ImageDescriptor[],
	renderer: Renderer,
	opts: BuildProjectOpts,
): Promise<[BuiltImage[], Dictionary<string>]> {
	const { logger, projectName } = opts;
	logger.logInfo(`Building for ${opts.arch}/${opts.deviceType}`);

	const needsQemu = await installQemuIfNeeded({ ...opts, imageDescriptors });

	const tarStream = await tarDirectory(opts.projectPath, opts);

	const tasks: BuildTaskPlus[] = await makeBuildTasks(
		opts.composition,
		tarStream,
		opts,
		logger,
		projectName,
	);

	const imageDescriptorsByServiceName = _.keyBy(
		imageDescriptors,
		'serviceName',
	);

	setTaskAttributes({ tasks, imageDescriptorsByServiceName, ...opts });

	const transposeOptArray: Array<TransposeOptions | undefined> =
		await Promise.all(
			tasks.map((task) => {
				// Setup emulation if needed
				if (needsQemu && !task.external) {
					return qemuTransposeBuildStream({ task, ...opts });
				}
			}),
		);

	await Promise.all(
		// transposeOptions may be undefined. That's OK.
		transposeOptArray.map((transposeOptions, index) =>
			setTaskProgressHooks({
				task: tasks[index],
				renderer,
				transposeOptions,
				...opts,
			}),
		),
	);

	logger.logDebug('Prepared tasks; building...');

	const { BALENA_ENGINE_TMP_PATH } = await import('../config.js');
	const builder = await import('@balena/compose/dist/multibuild');

	const builtImages = await builder.performBuilds(
		tasks,
		opts.docker,
		BALENA_ENGINE_TMP_PATH,
	);

	return await inspectBuiltImages({
		builtImages,
		imageDescriptorsByServiceName,
		tasks,
		...opts,
	});
}

async function startRenderer({
	imageDescriptors,
	inlineLogs,
	logger,
}: {
	imageDescriptors: ImageDescriptor[];
	inlineLogs?: boolean;
	logger: Logger;
}): Promise<Renderer> {
	let renderer: Renderer;
	if (inlineLogs) {
		renderer = new (await import('./compose.js')).BuildProgressInline(
			logger.streams['build'],
			imageDescriptors,
		);
	} else {
		const tty = (await import('./tty.js')).default(process.stdout);
		renderer = new (await import('./compose.js')).BuildProgressUI(
			tty,
			imageDescriptors,
		);
	}
	renderer.start();
	return renderer;
}

async function installQemuIfNeeded({
	arch,
	docker,
	emulated,
	imageDescriptors,
	logger,
	projectPath,
}: {
	arch: string;
	docker: Dockerode;
	emulated: boolean;
	imageDescriptors: ImageDescriptor[];
	logger: Logger;
	projectPath: string;
}): Promise<boolean> {
	const qemu = await import('./qemu.js');
	const needsQemu = await qemu.installQemuIfNeeded(
		emulated,
		logger,
		arch,
		docker,
	);
	if (needsQemu) {
		logger.logInfo('Emulation is enabled');
		// Copy qemu into all build contexts
		await Promise.all(
			imageDescriptors.map(function (d) {
				if (isBuildConfig(d.image)) {
					return qemu.copyQemu(
						path.join(projectPath, d.image.context || '.'),
						arch,
					);
				}
			}),
		);
	}
	return needsQemu;
}

export function makeImageName(
	projectName: string,
	serviceName: string,
	tag?: string,
) {
	let name = `${projectName}_${serviceName}`;
	if (tag) {
		name = [name, tag].map((s) => s.replace(/:/g, '_')).join(':');
	}
	return name.toLowerCase();
}

function setTaskAttributes({
	tasks,
	buildOpts,
	imageDescriptorsByServiceName,
	projectName,
}: {
	tasks: BuildTaskPlus[];
	buildOpts: import('./docker.js').BuildOpts;
	imageDescriptorsByServiceName: Dictionary<ImageDescriptor>;
	projectName: string;
}) {
	for (const task of tasks) {
		const d = imageDescriptorsByServiceName[task.serviceName];
		// multibuild (splitBuildStream) parses the composition internally so
		// any tags we've set before are lost; re-assign them here
		task.tag ??= makeImageName(projectName, task.serviceName, buildOpts.t);
		if (isBuildConfig(d.image)) {
			d.image.tag = task.tag;
		}
		// reassign task.args so that the `--buildArg` flag takes precedence
		// over assignments in the docker-compose.yml file (service.build.args)
		task.args = {
			...task.args,
			...buildOpts.buildargs,
		};

		// Docker image build options
		task.dockerOpts ??= {};
		if (task.args && Object.keys(task.args).length) {
			task.dockerOpts.buildargs = {
				...task.dockerOpts.buildargs,
				...task.args,
			};
		}
		_.merge(task.dockerOpts, buildOpts, { t: task.tag });
	}
}

async function qemuTransposeBuildStream({
	task,
	dockerfilePath,
	projectPath,
}: {
	task: BuildTaskPlus;
	dockerfilePath?: string;
	projectPath: string;
}): Promise<TransposeOptions> {
	const qemu = await import('./qemu.js');
	const binPath = qemu.qemuPathInContext(
		path.join(projectPath, task.context ?? ''),
	);
	if (task.buildStream == null) {
		throw new Error(`No buildStream for task '${task.tag}'`);
	}

	const transpose = await import('@balena/compose/dist/emulate');
	const { toPosixPath } = (await import('@balena/compose/dist/multibuild'))
		.PathUtils;

	const transposeOptions: TransposeOptions = {
		hostQemuPath: toPosixPath(binPath),
		containerQemuPath: `/tmp/${qemu.QEMU_BIN_NAME}`,
		qemuFileMode: 0o555,
	};

	task.buildStream = (await transpose.transposeTarStream(
		task.buildStream,
		transposeOptions,
		dockerfilePath || undefined,
	)) as Pack;

	return transposeOptions;
}

async function setTaskProgressHooks({
	inlineLogs,
	renderer,
	task,
	transposeOptions,
}: {
	inlineLogs?: boolean;
	renderer: Renderer;
	task: BuildTaskPlus;
	transposeOptions?: import('@balena/compose/dist/emulate').TransposeOptions;
}) {
	const transpose = await import('@balena/compose/dist/emulate');
	// Get the service-specific log stream
	const logStream = renderer.streams[task.serviceName];
	task.logBuffer = [];
	const captureStream = buildLogCapture(task.external, task.logBuffer);

	if (task.external) {
		// External image -- there's no build to be performed,
		// just follow pull progress.
		captureStream.pipe(logStream);
		task.progressHook = pullProgressAdapter(captureStream);
	} else {
		task.streamHook = function (stream) {
			let rawStream;
			stream = createLogStream(stream);
			if (transposeOptions) {
				const buildThroughStream =
					transpose.getBuildThroughStream(transposeOptions);
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
				.pipe(buildProgressAdapter(!!inlineLogs))
				.pipe(logStream);
		};
	}
}

async function inspectBuiltImages({
	builtImages,
	docker,
	imageDescriptorsByServiceName,
	tasks,
}: {
	builtImages: MultiBuild.LocalImage[];
	docker: Dockerode;
	imageDescriptorsByServiceName: Dictionary<ImageDescriptor>;
	tasks: BuildTaskPlus[];
}): Promise<[BuiltImage[], Dictionary<string>]> {
	const images: BuiltImage[] = await Promise.all(
		builtImages.map((builtImage: MultiBuild.LocalImage) =>
			inspectBuiltImage({
				builtImage,
				docker,
				imageDescriptorsByServiceName,
				tasks,
			}),
		),
	);

	const humanize = require('humanize');
	const summaryMsgByService: { [serviceName: string]: string } = {};
	for (const image of images) {
		summaryMsgByService[image.serviceName] = `Image size: ${humanize.filesize(
			image.props.size,
		)}`;
	}

	return [images, summaryMsgByService];
}

async function inspectBuiltImage({
	builtImage,
	docker,
	imageDescriptorsByServiceName,
	tasks,
}: {
	builtImage: MultiBuild.LocalImage;
	docker: Dockerode;
	imageDescriptorsByServiceName: Dictionary<ImageDescriptor>;
	tasks: BuildTaskPlus[];
}): Promise<BuiltImage> {
	if (!builtImage.successful) {
		const error: Error & { serviceName?: string } =
			builtImage.error ?? new Error();
		error.serviceName = builtImage.serviceName;
		throw error;
	}

	const d = imageDescriptorsByServiceName[builtImage.serviceName];
	const task = _.find(tasks, {
		serviceName: builtImage.serviceName,
	});

	const image: BuiltImage = {
		serviceName: d.serviceName,
		name: (isBuildConfig(d.image) ? d.image.tag : d.image) || '',
		logs: truncateString(task?.logBuffer?.join('\n') || '', LOG_LENGTH_MAX),
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
	image.props.size = (await docker.getImage(image.name).inspect()).Size;

	return image;
}

/**
 * Load the ".balena/balena.yml" file (or resin.yml, or yaml or json),
 * which contains "build metadata" for features like "build secrets" and
 * "build variables".
 * @returns Pair of metadata object and metadata file path
 */
async function loadBuildMetatada(
	sourceDir: string,
): Promise<[MultiBuild.ParsedBalenaYml, string]> {
	let metadataPath = '';
	let rawString = '';

	outer: for (const fName of ['balena', 'resin']) {
		for (const fExt of ['yml', 'yaml', 'json']) {
			metadataPath = path.join(sourceDir, `.${fName}`, `${fName}.${fExt}`);
			try {
				rawString = await fs.readFile(metadataPath, 'utf8');
				break outer;
			} catch (err) {
				if (err.code === 'ENOENT') {
					// file not found, try the next name.extension combination
					continue;
				} else {
					throw err;
				}
			}
		}
	}
	if (!rawString) {
		return [{}, ''];
	}
	let buildMetadata: MultiBuild.ParsedBalenaYml;
	try {
		if (metadataPath.endsWith('json')) {
			buildMetadata = JSON.parse(rawString);
		} else {
			buildMetadata = require('js-yaml').load(rawString);
		}
	} catch (err) {
		throw new ExpectedError(
			`Error parsing file "${metadataPath}":\n ${err.message}`,
		);
	}
	return [buildMetadata, metadataPath];
}

/**
 * Return a map of service name to service subdirectory (relative to sourceDir),
 * obtained from the given composition object. If a composition object is not
 * provided, an attempt will be made to parse a 'docker-compose.yml' file at
 * the given sourceDir.
 * @param sourceDir Project source directory (project root)
 * @param composition Optional previously parsed composition object
 */
export async function getServiceDirsFromComposition(
	sourceDir: string,
	composition?: Composition,
): Promise<Dictionary<string>> {
	const { createProject } = await import('./compose.js');
	const serviceDirs: Dictionary<string> = {};
	if (!composition) {
		const [, composeStr] = await resolveProject(
			Logger.getLogger(),
			sourceDir,
			true,
		);
		if (composeStr) {
			composition = createProject(sourceDir, composeStr).composition;
		}
	}
	if (composition?.services) {
		const relPrefix = '.' + path.sep;
		for (const [serviceName, service] of Object.entries(composition.services)) {
			let dir =
				(typeof service.build === 'string'
					? service.build
					: service.build?.context) || '.';
			// Convert forward slashes to backslashes on Windows
			dir = path.normalize(dir);
			// Make sure the path is relative to the project directory
			if (path.isAbsolute(dir)) {
				dir = path.relative(sourceDir, dir);
			}
			// remove a trailing '/' (or backslash on Windows)
			dir = dir.endsWith(path.sep) ? dir.slice(0, -1) : dir;
			// remove './' prefix (or '.\\' on Windows)
			dir = dir.startsWith(relPrefix) ? dir.slice(2) : dir;

			serviceDirs[serviceName] = dir || '.';
		}
	}
	return serviceDirs;
}

/**
 * Return true if `image` is actually a docker-compose.yml `services.service.build`
 * configuration object, rather than an "external image" (`services.service.image`).
 *
 * The `image` argument may therefore refer to either a `build` or `image` property
 * of a service in a docker-compose.yml file, which is a bit confusing but it matches
 * the `ImageDescriptor.image` property as defined by `@balena/compose/parse`.
 *
 * Note that `@balena/compose/parse` "normalizes" the docker-compose.yml file such
 * that, if `services.service.build` is a string, it is converted to a BuildConfig
 * object with the string value assigned to `services.service.build.context`:
 * https://github.com/balena-io-modules/balena-compose/blob/v0.1.0/lib/parse/compose.ts#L166-L167
 * This is why this implementation works when `services.service.build` is defined
 * as a string in the docker-compose.yml file.
 *
 * @param image The `ImageDescriptor.image` attribute parsed with `@balena/compose/parse`
 */
export function isBuildConfig(
	image: string | BuildConfig,
): image is BuildConfig {
	return image != null && typeof image !== 'string';
}

/**
 * Create a tar stream out of the local filesystem at the given directory,
 * while optionally applying file filters such as '.dockerignore' and
 * optionally converting text file line endings (CRLF to LF).
 * @param dir Project directory (the '--source' command line option)
 * @param param TarDirectoryOptions
 * @returns Readable stream (to be sent to the Docker Engine)
 */
export async function tarDirectory(
	dir: string,
	{
		composition,
		convertEol = false,
		multiDockerignore = false,
		preFinalizeCallback,
	}: TarDirectoryOptions,
): Promise<import('stream').Readable> {
	const { filterFilesWithDockerignore } = await import('./ignore.js');
	const { toPosixPath } = (await import('@balena/compose/dist/multibuild'))
		.PathUtils;

	let readFile: (file: string) => Promise<Buffer>;
	if (process.platform === 'win32') {
		const { readFileWithEolConversion } = require('./eol-conversion');
		readFile = (file) => readFileWithEolConversion(file, convertEol);
	} else {
		readFile = fs.readFile;
	}
	const tar = await import('tar-stream');
	const pack = tar.pack();
	const serviceDirs = await getServiceDirsFromComposition(dir, composition);
	const { filteredFileList, dockerignoreFiles } =
		await filterFilesWithDockerignore(dir, multiDockerignore, serviceDirs);
	printDockerignoreWarn(dockerignoreFiles, serviceDirs, multiDockerignore);
	for (const fileStats of filteredFileList) {
		pack.entry(
			{
				name: toPosixPath(fileStats.relPath),
				mtime: fileStats.stats.mtime,
				mode: fileStats.stats.mode,
				size: fileStats.stats.size,
			},
			await readFile(fileStats.filePath),
		);
	}
	if (preFinalizeCallback) {
		await preFinalizeCallback(pack);
	}
	pack.finalize();
	return pack;
}

/**
 * Print warning messages for unused .dockerignore files, and info messages if
 * the --multi-dockerignore (-m) option is used in certain circumstances.
 * @param dockerignoreFiles All .dockerignore files found in the project
 * @param serviceDirsByService Map of service names to service subdirectories
 * @param multiDockerignore Whether --multi-dockerignore (-m) was provided
 */
function printDockerignoreWarn(
	dockerignoreFiles: Array<import('./ignore.js').FileStats>,
	serviceDirsByService: Dictionary<string>,
	multiDockerignore: boolean,
) {
	let rootDockerignore: import('./ignore.js').FileStats | undefined;
	const logger = Logger.getLogger();
	const relPrefix = '.' + path.sep;
	const serviceDirs = Object.values(serviceDirsByService || {});
	// compute a list of unused .dockerignore files
	const unusedFiles = dockerignoreFiles.filter(
		(dockerignoreStats: import('./ignore.js').FileStats) => {
			let dirname = path.dirname(dockerignoreStats.relPath);
			dirname = dirname.startsWith(relPrefix) ? dirname.slice(2) : dirname;
			const isProjectRootDir = !dirname || dirname === '.';
			if (isProjectRootDir) {
				rootDockerignore = dockerignoreStats;
				return false; // a root .dockerignore file is always used
			}
			if (multiDockerignore) {
				for (const serviceDir of serviceDirs) {
					if (serviceDir === dirname) {
						return false;
					}
				}
			}
			return true;
		},
	);
	const msg: string[] = [];
	let logFunc = logger.logWarn;
	// Warn about unused .dockerignore files
	if (unusedFiles.length) {
		msg.push(
			'The following .dockerignore file(s) will not be used:',
			...unusedFiles.map((fileStats) => `* ${fileStats.filePath}`),
		);
		if (multiDockerignore) {
			msg.push(stripIndent`
				When --multi-dockerignore (-m) is used, only .dockerignore files at the
				root of each service's build context (in a microservices/multicontainer
				fleet), plus a .dockerignore file at the overall project root, are used.
				See "balena help ${Logger.command}" for more details.`);
		} else {
			msg.push(stripIndent`
				By default, only one .dockerignore file at the source folder (project
				root) is used. Microservices (multicontainer) fleets may use a separate
				.dockerignore file for each service with the --multi-dockerignore (-m)
				option. See "balena help ${Logger.command}" for more details.`);
		}
	}
	// No unused .dockerignore files. Print info-level advice in some cases.
	else if (multiDockerignore) {
		logFunc = logger.logInfo;
		// multi-container app with a root .dockerignore file
		if (serviceDirs.length && rootDockerignore) {
			msg.push(
				stripIndent`
				The --multi-dockerignore option is being used, and a .dockerignore file was
				found at the project source (root) directory. Note that this file will not
				be used to filter service subdirectories. See "balena help ${Logger.command}".`,
			);
		}
		// single-container app
		else if (serviceDirs.length === 0) {
			msg.push(
				stripIndent`
				The --multi-dockerignore (-m) option was specified, but it has no effect for
				single-container (non-microservices) fleets. Only one .dockerignore file at the
				project source (root) directory, if any, is used. See "balena help ${Logger.command}".`,
			);
		}
	}
	if (msg.length) {
		const { warnify } = require('./messages') as typeof import('./messages.js');
		logFunc.call(logger, ' \n' + warnify(msg.join('\n'), ''));
	}
}

/**
 * Check whether the "build secrets" feature is being used and, if so,
 * verify that the target docker daemon is balenaEngine. If the
 * requirement is not satisfied, reject with an ExpectedError.
 * @param docker Dockerode instance
 * @param sourceDir Project directory where to find .balena/balena.yml
 */
export async function checkBuildSecretsRequirements(
	docker: Dockerode,
	sourceDir: string,
) {
	const [metaObj, metaFilename] = await loadBuildMetatada(sourceDir);
	if (metaObj && !_.isEmpty(metaObj['build-secrets'])) {
		const dockerUtils = await import('./docker.js');
		const isBalenaEngine = await dockerUtils.isBalenaEngine(docker);
		if (!isBalenaEngine) {
			throw new ExpectedError(stripIndent`
				The "build secrets" feature currently requires balenaEngine, but a standard Docker
				daemon was detected. Please use command-line options to specify the hostname and
				port number (or socket path) of a balenaEngine daemon, running on a balena device
				or a virtual machine with balenaOS. If the build secrets feature is not required,
				comment out or delete the 'build-secrets' entry in the file:
				"${metaFilename}"
				`);
		}
	}
}

export async function getRegistrySecrets(
	sdk: BalenaSDK,
	inputFilename?: string,
): Promise<MultiBuild.RegistrySecrets> {
	if (inputFilename != null) {
		return await parseRegistrySecrets(inputFilename);
	}

	const directory = await sdk.settings.get('dataDirectory');
	const potentialPaths = [
		path.join(directory, 'secrets.yml'),
		path.join(directory, 'secrets.yaml'),
		path.join(directory, 'secrets.json'),
	];

	for (const potentialPath of potentialPaths) {
		if (await exists(potentialPath)) {
			return await parseRegistrySecrets(potentialPath);
		}
	}

	return {};
}

async function parseRegistrySecrets(
	secretsFilename: string,
): Promise<MultiBuild.RegistrySecrets> {
	try {
		let isYaml = false;
		if (/.+\.ya?ml$/i.test(secretsFilename)) {
			isYaml = true;
		} else if (!/.+\.json$/i.test(secretsFilename)) {
			throw new ExpectedError('Filename must end with .json, .yml or .yaml');
		}
		const raw = (await fs.readFile(secretsFilename)).toString();
		const multiBuild = await import('@balena/compose/dist/multibuild');
		const registrySecrets =
			new multiBuild.RegistrySecretValidator().validateRegistrySecrets(
				isYaml ? require('js-yaml').load(raw) : JSON.parse(raw),
			);
		multiBuild.addCanonicalDockerHubEntry(registrySecrets);
		return registrySecrets;
	} catch (error) {
		throw new ExpectedError(
			`Error validating registry secrets file "${secretsFilename}":\n${error.message}`,
		);
	}
}

/**
 * Create a BuildTask array of "resolved build tasks" by calling multibuild
 * .splitBuildStream() and performResolution(), and add build stream error
 * handlers and debug logging.
 * Both `balena build` and `balena deploy` call this function.
 */
export async function makeBuildTasks(
	composition: Composition,
	tarStream: Readable,
	deviceInfo: DeviceInfo,
	logger: Logger,
	projectName: string,
	releaseHash: string = 'unavailable',
	preprocessHook?: (dockerfile: string) => string,
): Promise<MultiBuild.BuildTask[]> {
	const multiBuild = await import('@balena/compose/dist/multibuild');
	const buildTasks = await multiBuild.splitBuildStream(composition, tarStream);

	logger.logDebug('Found build tasks:');
	_.each(buildTasks, (task) => {
		let infoStr: string;
		if (task.external) {
			infoStr = `image pull [${task.imageName}]`;
		} else {
			infoStr = `build [${task.context}]`;
		}
		logger.logDebug(`    ${task.serviceName}: ${infoStr}`);
		task.logger = logger.getAdapter();
	});

	logger.logDebug(
		`Resolving services with [${deviceInfo.deviceType}|${deviceInfo.arch}]`,
	);

	await performResolution(
		buildTasks,
		deviceInfo,
		projectName,
		releaseHash,
		preprocessHook,
	);

	logger.logDebug('Found project types:');
	_.each(buildTasks, (task) => {
		if (task.external) {
			logger.logDebug(`    ${task.serviceName}: External image`);
		} else {
			logger.logDebug(`    ${task.serviceName}: ${task.projectType}`);
		}
	});

	return buildTasks;
}

async function performResolution(
	tasks: MultiBuild.BuildTask[],
	deviceInfo: DeviceInfo,
	appName: string,
	releaseHash: string,
	preprocessHook?: (dockerfile: string) => string,
): Promise<MultiBuild.BuildTask[]> {
	const multiBuild = await import('@balena/compose/dist/multibuild');
	const resolveListeners: MultiBuild.ResolveListeners = {};
	const resolvePromise = new Promise<never>((_resolve, reject) => {
		resolveListeners.error = [reject];
	});
	const buildTasks = multiBuild.performResolution(
		tasks,
		deviceInfo.arch,
		deviceInfo.deviceType,
		resolveListeners,
		{
			BALENA_RELEASE_HASH: releaseHash,
			BALENA_APP_NAME: appName,
		},
		preprocessHook,
	);
	await Promise.race([resolvePromise, resolveTasks(buildTasks)]);
	return buildTasks;
}

async function resolveTasks(buildTasks: MultiBuild.BuildTask[]) {
	const { cloneTarStream } = await import('tar-utils');
	// Do one task at a time in order to reduce peak memory usage. Resolves to buildTasks.
	for (const buildTask of buildTasks) {
		// buildStream is falsy for "external" tasks (image pull)
		if (!buildTask.buildStream) {
			continue;
		}
		let error: Error | undefined;
		try {
			// Consume each task.buildStream in order to trigger the
			// resolution events that define fields like:
			//     task.dockerfile, task.dockerfilePath,
			//     task.projectType, task.resolved
			// This mimics what is currently done in `resin-builder`.
			buildTask.buildStream = await cloneTarStream(buildTask.buildStream);
		} catch (e) {
			error = e;
		}
		if (error || (!buildTask.external && !buildTask.resolved)) {
			const cause = error ? `${error}\n` : '';
			throw new ExpectedError(
				`${cause}Project type for service "${buildTask.serviceName}" could not be determined. Missing a Dockerfile?`,
			);
		}
	}
}

/**
 * Enforce that, for example, if 'myProject/MyDockerfile.template' is specified
 * as an alternativate Dockerfile name, then 'myProject/MyDockerfile' must not
 * exist.
 * Return the tar stream path (Posix, normalized) for the given dockerfilePath.
 * For example, on Windows, given a dockerfilePath of 'foo\..\bar\Dockerfile',
 * return 'bar/Dockerfile'. On Linux, given './bar/Dockerfile', return 'bar/Dockerfile'.
 *
 * @param projectPath The project source folder (-s command-line option)
 * @param dockerfilePath The alternative Dockerfile specified by the user
 * @return A normalized posix representation of dockerfilePath
 */
async function validateSpecifiedDockerfile(
	projectPath: string,
	dockerfilePath: string,
): Promise<string> {
	const { contains, toNativePath, toPosixPath } = (
		await import('@balena/compose/dist/multibuild')
	).PathUtils;

	const nativeProjectPath = path.normalize(projectPath);
	const nativeDockerfilePath = path.normalize(toNativePath(dockerfilePath));

	// reminder: native windows paths may start with a drive specificaton,
	// e.g. 'C:\absolute' or 'C:relative'.
	if (path.isAbsolute(nativeDockerfilePath)) {
		throw new ExpectedError(stripIndent`
			Error: the specified Dockerfile cannot be an absolute path. The path must be
			relative to, and not a parent folder of, the project's source folder.
			Specified dockerfile: "${nativeDockerfilePath}"
			Project's source folder: "${nativeProjectPath}"
		`);
	}

	// note that path.normalize('a/../../b') results in '../b'
	if (nativeDockerfilePath.startsWith('..')) {
		throw new ExpectedError(stripIndent`
			Error: the specified Dockerfile cannot be in a parent folder of the project's
			source folder. Note that the path should be relative to the project's source
			folder, not the current folder.
			Specified dockerfile: "${nativeDockerfilePath}"
			Project's source folder: "${nativeProjectPath}"
		`);
	}

	const fullDockerfilePath = path.join(nativeProjectPath, nativeDockerfilePath);

	if (!(await exists(fullDockerfilePath))) {
		throw new ExpectedError(stripIndent`
			Error: specified Dockerfile not found:
			Specified dockerfile: "${fullDockerfilePath}"
			Project's source folder: "${nativeProjectPath}"
			Note that the specified Dockerfile path should be relative to the source folder.
		`);
	}

	if (!contains(nativeProjectPath, fullDockerfilePath)) {
		throw new ExpectedError(stripIndent`
			Error: the specified Dockerfile must be in a subfolder of the source folder:
			Specified dockerfile: "${fullDockerfilePath}"
			Project's source folder: "${nativeProjectPath}"
		`);
	}

	return toPosixPath(nativeDockerfilePath);
}

export interface ProjectValidationResult {
	dockerfilePath: string;
	registrySecrets: MultiBuild.RegistrySecrets;
}

/**
 * Perform "sanity checks" on the project directory, e.g. for the existence
 * of a 'Dockerfile[.*]' or 'docker-compose.yml' file or 'package.json' file.
 * Also validate registry secrets if any, and perform checks around an
 * alternative specified dockerfile (--dockerfile) if any.
 *
 * Return the parsed registry secrets if any, and the "tar stream path" for
 * an alternative specified Dockerfile if any (see validateSpecifiedDockerfile()).
 */
export async function validateProjectDirectory(
	sdk: BalenaSDK,
	opts: {
		dockerfilePath?: string;
		noParentCheck: boolean;
		projectPath: string;
		registrySecretsPath?: string;
	},
): Promise<ProjectValidationResult> {
	if (
		!(await exists(opts.projectPath)) ||
		!(await fs.stat(opts.projectPath)).isDirectory()
	) {
		throw new ExpectedError(
			`Could not access source folder: "${opts.projectPath}"`,
		);
	}

	const result: ProjectValidationResult = {
		dockerfilePath: opts.dockerfilePath || '',
		registrySecrets: {},
	};

	if (opts.dockerfilePath) {
		result.dockerfilePath = await validateSpecifiedDockerfile(
			opts.projectPath,
			opts.dockerfilePath,
		);
	} else {
		const files = await fs.readdir(opts.projectPath);
		const projectMatch = (file: string) =>
			/^(Dockerfile|Dockerfile\.\S+|docker-compose.ya?ml|package.json)$/.test(
				file,
			);
		if (!_.some(files, projectMatch)) {
			throw new ExpectedError(stripIndent`
				Error: no "Dockerfile[.*]", "docker-compose.yml" or "package.json" file
				found in source folder "${opts.projectPath}"
			`);
		}
		if (!opts.noParentCheck) {
			const checkCompose = async (folder: string) => {
				return _.some(
					await Promise.all(
						compositionFileNames.map((filename) =>
							exists(path.join(folder, filename)),
						),
					),
				);
			};
			const [hasCompose, hasParentCompose] = await Promise.all([
				checkCompose(opts.projectPath),
				checkCompose(path.join(opts.projectPath, '..')),
			]);
			if (!hasCompose && hasParentCompose) {
				const msg = stripIndent`
					"docker-compose.y[a]ml" file found in parent directory: please check that
					the correct source folder was specified. (Suppress with '--noparent-check'.)`;
				throw new ExpectedError(`Error: ${msg}`);
			}
		}
	}
	result.registrySecrets = await getRegistrySecrets(
		sdk,
		opts.registrySecretsPath,
	);

	return result;
}

async function getTokenForPreviousRepos(
	logger: Logger,
	appId: number,
	apiEndpoint: string,
	taggedImages: TaggedImage[],
): Promise<string> {
	logger.logDebug('Authorizing push...');
	const { authorizePush, getPreviousRepos } = await import('./compose.js');
	const sdk = getBalenaSdk();
	const previousRepos = await getPreviousRepos(sdk, logger, appId);

	const token = await authorizePush(
		sdk,
		apiEndpoint,
		taggedImages[0].registry,
		_.map(taggedImages, 'repo'),
		previousRepos,
	);
	return token;
}

async function pushAndUpdateServiceImages(
	docker: Dockerode,
	token: string,
	images: TaggedImage[],
	afterEach: (serviceImage: ImageModel, props: object) => Promise<void>,
) {
	const { DockerProgress } = await import('docker-progress');
	const { retry } = await import('./helpers.js');
	const { pushProgressRenderer } = await import('./compose.js');
	const tty = (await import('./tty.js')).default(process.stdout);
	const opts = { authconfig: { registrytoken: token } };
	const progress = new DockerProgress({ docker });
	const renderer = pushProgressRenderer(
		tty,
		getChalk().blue('[Push]') + '    ',
	);
	const reporters = progress.aggregateProgress(images.length, renderer);

	const pushImage = async (
		localImage: Dockerode.Image,
		index: number,
	): Promise<string> => {
		try {
			// TODO 'localImage as any': find out exactly why tsc warns about
			// 'name' that exists as a matter of fact, with a value similar to:
			// "name": "registry2.balena-cloud.com/v2/aa27790dff571ec7d2b4fbcf3d4648d5:latest"
			const imgName: string = (localImage as any).name || '';
			const imageDigest: string = await retry({
				func: () => progress.push(imgName, reporters[index], opts),
				maxAttempts: 3, // try calling func 3 times (max)
				label: imgName, // label for retry log messages
				initialDelayMs: 2000, // wait 2 seconds before the 1st retry
				backoffScaler: 1.4, // wait multiplier for each retry
			});
			if (!imageDigest) {
				throw new ExpectedError(stripIndent`\
					Unable to extract image digest (content hash) from image upload progress stream for image:
					${imgName}`);
			}
			return imageDigest;
		} finally {
			renderer.end();
		}
	};

	const inspectAndPushImage = async (
		{ serviceImage, localImage, props, logs }: TaggedImage,
		index: number,
	) => {
		try {
			const [imgInfo, imgDigest] = await Promise.all([
				localImage.inspect(),
				pushImage(localImage, index),
			]);
			serviceImage.image_size = imgInfo.Size;
			serviceImage.content_hash = imgDigest;
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
		} catch (error) {
			serviceImage.error_message = '' + error;
			serviceImage.status = 'failed';
			throw error;
		} finally {
			await afterEach(serviceImage, props);
		}
	};

	tty.hideCursor();
	try {
		await Promise.all(images.map(inspectAndPushImage));
	} finally {
		tty.showCursor();
	}
}

async function pushServiceImages(
	docker: Dockerode,
	logger: Logger,
	pineClient: import('@balena/compose').release.Request['client'],
	taggedImages: TaggedImage[],
	token: string,
	skipLogUpload: boolean,
): Promise<void> {
	const releaseMod = (await import('@balena/compose')).release;
	logger.logInfo('Pushing images to registry...');
	await pushAndUpdateServiceImages(
		docker,
		token,
		taggedImages,
		async function (serviceImage) {
			logger.logDebug(
				`Saving image ${serviceImage.is_stored_at__image_location}`,
			);
			if (skipLogUpload) {
				delete serviceImage.build_log;
			}
			await releaseMod.updateImage(pineClient, serviceImage.id, serviceImage);
		},
	);
}

export async function deployProject(
	docker: Dockerode,
	sdk: BalenaSDK,
	logger: Logger,
	composition: Composition,
	images: BuiltImage[],
	appId: number,
	skipLogUpload: boolean,
	projectPath: string,
	isDraft: boolean,
): Promise<ReleaseModel> {
	const releaseMod = await import('@balena/compose/dist/release');
	const { createRelease, tagServiceImages } = await import('./compose.js');
	const tty = (await import('./tty.js')).default(process.stdout);

	const prefix = getChalk().cyan('[Info]') + '    ';
	const spinner = createSpinner();

	const contractPath = path.join(projectPath, 'balena.yml');
	const contract = await getContractContent(contractPath);
	if (contract?.version && !semver.valid(contract.version)) {
		throw new ExpectedError(stripIndent`\
			Error: the version field in "${contractPath}"
			is not a valid semver`);
	}
	const apiEndpoint = await sdk.settings.get('apiUrl');

	const $release = await runSpinner(
		tty,
		spinner,
		`${prefix}Creating release...`,
		() =>
			createRelease(
				sdk,
				logger,
				appId,
				composition,
				isDraft,
				contract?.version,
				contract ? JSON.stringify(contract) : undefined,
			),
	);
	const { client: pineClient, release, serviceImages } = $release;

	try {
		logger.logDebug('Tagging images...');
		const taggedImages = await tagServiceImages(docker, images, serviceImages);
		try {
			const { awaitInterruptibleTask } = await import('./helpers.js');
			// awaitInterruptibleTask throws SIGINTError on CTRL-C,
			// causing the release status to be set to 'failed'
			await awaitInterruptibleTask(async () => {
				const token = await getTokenForPreviousRepos(
					logger,
					appId,
					apiEndpoint,
					taggedImages,
				);
				await pushServiceImages(
					docker,
					logger,
					pineClient,
					taggedImages,
					token,
					skipLogUpload,
				);
			});
			release.status = 'success';
		} catch (err) {
			release.status = 'failed';
			throw err;
		} finally {
			logger.logDebug('Untagging images...');
			await Promise.all(
				taggedImages.map(({ localImage }) => localImage.remove()),
			);
		}
	} finally {
		await runSpinner(tty, spinner, `${prefix}Saving release...`, async () => {
			release.end_timestamp = new Date();
			if (release.id != null) {
				await releaseMod.updateRelease(pineClient, release.id, release);
			}
		});
	}
	return release;
}

export function createSpinner() {
	const chars = '|/-\\';
	let index = 0;
	return () => chars[index++ % chars.length];
}

async function runSpinner<T>(
	tty: ReturnType<typeof import('./tty.js').default>,
	spinner: () => string,
	msg: string,
	fn: () => Promise<T>,
): Promise<T> {
	const runloop = createRunLoop(function () {
		tty.clearLine();
		tty.writeLine(`${msg} ${spinner()}`);
		tty.cursorUp();
	});
	runloop.onEnd = function () {
		tty.clearLine();
		tty.writeLine(msg);
	};
	try {
		return await fn();
	} finally {
		runloop.end();
	}
}

export function createRunLoop(tick: (...args: any[]) => void) {
	const timerId = setInterval(tick, 1000 / 10);
	const runloop = {
		onEnd() {
			// noop
		},
		end() {
			clearInterval(timerId);
			return runloop.onEnd();
		},
	};
	return runloop;
}

async function getContractContent(
	filePath: string,
): Promise<Dictionary<any> | undefined> {
	let fileContentAsString;
	try {
		fileContentAsString = await fs.readFile(filePath, 'utf8');
	} catch (e) {
		if (e.code === 'ENOENT') {
			return; // File does not exist
		}
		throw e;
	}

	let asJson;
	try {
		asJson = jsyaml.load(fileContentAsString);
	} catch (err) {
		throw new ExpectedError(
			`Error parsing file "${filePath}":\n ${err.message}`,
		);
	}

	if (!isContract(asJson)) {
		throw new ExpectedError(
			stripIndent`Error: application contract in '${filePath}' needs to
				define a top level "type" field with an allowed application type.
				Allowed application types are: ${allowedContractTypes.join(', ')}`,
		);
	}
	return asJson;
}

function isContract(obj: any): obj is Dictionary<any> {
	return obj?.type && allowedContractTypes.includes(obj.type);
}

function createLogStream(input: Readable) {
	const split = require('split') as typeof import('split');
	const stripAnsi = require('strip-ansi-stream');
	return input.pipe<Duplex>(stripAnsi()).pipe(split());
}

function dropEmptyLinesStream() {
	const through = require('through2') as typeof import('through2');
	return through(function (data, _enc, cb) {
		const str = data.toString('utf-8');
		if (str.trim()) {
			this.push(str);
		}
		return cb();
	});
}

function buildLogCapture(objectMode: boolean, buffer: string[]) {
	const through = require('through2') as typeof import('through2');

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
}

function buildProgressAdapter(inline: boolean) {
	const through = require('through2') as typeof import('through2');

	const stepRegex = /^\s*Step\s+(\d+)\/(\d+)\s*: (.+)$/;

	let step = '';
	let numSteps = '';
	let progress: number | undefined;

	return through({ objectMode: true }, function (str, _enc, cb) {
		if (str == null) {
			return cb(null, str);
		}

		if (inline) {
			return cb(null, { status: str });
		}

		if (!/^Successfully tagged /.test(str)) {
			const match = stepRegex.exec(str);
			if (match) {
				step = match[1];
				numSteps ??= match[2];
				str = match[3];
			}
			if (step) {
				str = `Step ${step}/${numSteps}: ${str}`;
				progress = Math.floor(
					(parseInt(step, 10) * 100) / parseInt(numSteps, 10),
				);
			}
		}

		return cb(null, { status: str, progress });
	});
}

function pullProgressAdapter(outStream: Duplex) {
	return function ({
		status,
		id,
		percentage,
		error,
		errorDetail,
	}: {
		status: string;
		id: string;
		percentage: number | undefined;
		error: Error;
		errorDetail: Error;
	}) {
		id ||= '';
		status ||= '';
		const isTotal = id && id.toLowerCase() === 'total';
		if (status) {
			status = status.replace(/^Status: /, '');
		} else if (isTotal && typeof percentage === 'number') {
			status = `Pull progress: ${percentage}%`;
		}
		if (id && status && !isTotal) {
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
}

function truncateString(str: string, len: number): string {
	if (str.length < len) {
		return str;
	}
	str = str.slice(0, len);
	// return everything up to the last line. this is a cheeky way to avoid
	// having to deal with splitting the string midway through some special
	// character sequence.
	return str.slice(0, str.lastIndexOf('\n'));
}

export const composeCliFlags = {
	emulated: Flags.boolean({
		description:
			'Use QEMU for ARM architecture emulation during the image build',
		char: 'e',
	}),
	dockerfile: Flags.string({
		description:
			'Alternative Dockerfile name/path, relative to the source folder',
	}),
	nologs: Flags.boolean({
		description:
			'Hide the image build log output (produce less verbose output)',
	}),
	'multi-dockerignore': Flags.boolean({
		description:
			'Have each service use its own .dockerignore file. See "balena help build".',
		char: 'm',
	}),
	'noparent-check': Flags.boolean({
		description:
			"Disable project validation check of 'docker-compose.yml' file in parent folder",
	}),
	'registry-secrets': Flags.string({
		description:
			'Path to a YAML or JSON file with passwords for a private Docker registry',
		char: 'R',
	}),
	'noconvert-eol': Flags.boolean({
		description:
			"Don't convert line endings from CRLF (Windows format) to LF (Unix format).",
	}),
	projectName: Flags.string({
		description: stripIndent`\
			Name prefix for locally built images. This is the 'projectName' portion
			in 'projectName_serviceName:tag'. The default is the directory name.`,
		char: 'n',
	}),
};
