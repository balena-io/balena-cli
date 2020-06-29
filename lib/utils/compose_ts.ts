/**
 * @license
 * Copyright 2018-2020 Balena Ltd.
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
import { BalenaSDK } from 'balena-sdk';
import * as Bluebird from 'bluebird';
import type * as Dockerode from 'dockerode';
import * as _ from 'lodash';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Composition } from 'resin-compose-parse';
import * as MultiBuild from 'resin-multibuild';
import { Readable } from 'stream';
import * as tar from 'tar-stream';
import { stripIndent } from './lazy';

import { ExpectedError } from '../errors';
import { getBalenaSdk, getChalk } from '../utils/lazy';
import {
	BuiltImage,
	ComposeOpts,
	ComposeProject,
	Release,
	TaggedImage,
	TarDirectoryOptions,
} from './compose-types';
import { DeviceInfo } from './device/api';
import Logger = require('./logger');

export interface RegistrySecrets {
	[registryAddress: string]: {
		username: string;
		password: string;
	};
}

const exists = async (filename: string) => {
	try {
		await fs.access(filename);
		return true;
	} catch {
		return false;
	}
};

const compositionFileNames = ['docker-compose.yml', 'docker-compose.yaml'];

const hr =
	'----------------------------------------------------------------------';

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
): Promise<ComposeProject> {
	const compose = await import('resin-compose-parse');
	const { createProject } = await import('./compose');
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
	}
	logger.logDebug('Creating project...');
	return createProject(opts.projectPath, composeStr, opts.projectName);
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
			buildMetadata = require('js-yaml').safeLoad(rawString);
		}
	} catch (err) {
		throw new ExpectedError(
			`Error parsing file "${metadataPath}":\n ${err.message}`,
		);
	}
	return [buildMetadata, metadataPath];
}

/**
 * Return a map of service name to service subdirectory, obtained from the given
 * composition object. If a composition object is not provided, an attempt will
 * be made to parse a 'docker-compose.yml' file at the given sourceDir.
 * Entries will be NOT be returned for subdirectories equal to '.' (e.g. the
 * 'main' "service" of a single-container application).
 *
 * @param sourceDir Project source directory (project root)
 * @param composition Optional previously parsed composition object
 */
async function getServiceDirsFromComposition(
	sourceDir: string,
	composition?: Composition,
): Promise<Dictionary<string>> {
	const { createProject } = await import('./compose');
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
				typeof service.build === 'string'
					? service.build
					: service.build?.context || '.';
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
			// filter out a '.' service directory (e.g. for the 'main' service
			// of a single-container application)
			if (dir && dir !== '.') {
				serviceDirs[serviceName] = dir;
			}
		}
	}
	return serviceDirs;
}

/**
 * Create a tar stream out of the local filesystem at the given directory,
 * while optionally applying file filters such as '.dockerignore' and
 * optionally converting text file line endings (CRLF to LF).
 * @param dir Source directory
 * @param param Options
 * @returns {Promise<import('stream').Readable>}
 */
export async function tarDirectory(
	dir: string,
	{
		composition,
		convertEol = false,
		multiDockerignore = false,
		nogitignore = false,
		preFinalizeCallback,
	}: TarDirectoryOptions,
): Promise<import('stream').Readable> {
	(await import('assert')).strict.strictEqual(nogitignore, true);
	const { filterFilesWithDockerignore } = await import('./ignore');
	const { toPosixPath } = (await import('resin-multibuild')).PathUtils;

	const serviceDirs = multiDockerignore
		? await getServiceDirsFromComposition(dir, composition)
		: {};

	let readFile: (file: string) => Promise<Buffer>;
	if (process.platform === 'win32') {
		const { readFileWithEolConversion } = require('./eol-conversion');
		readFile = (file) => readFileWithEolConversion(file, convertEol);
	} else {
		readFile = fs.readFile;
	}
	const pack = tar.pack();
	const {
		filteredFileList,
		dockerignoreFiles,
	} = await filterFilesWithDockerignore(dir, serviceDirs);
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
export function printDockerignoreWarn(
	dockerignoreFiles: Array<import('./ignore').FileStats>,
	serviceDirsByService: Dictionary<string>,
	multiDockerignore: boolean,
) {
	let rootDockerignore: import('./ignore').FileStats | undefined;
	const logger = Logger.getLogger();
	const relPrefix = '.' + path.sep;
	const serviceDirs = Object.values(serviceDirsByService || {});
	// compute a list of unused .dockerignore files
	const unusedFiles = dockerignoreFiles.filter(
		(dockerignoreStats: import('./ignore').FileStats) => {
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
				When --multi-dockerignore (-m) is used, only .dockerignore files at the root of
				each service's build context (in a microservices/multicontainer application),
				plus a .dockerignore file at the overall project root, are used.
				See "balena help ${Logger.command}" for more details.`);
		} else {
			msg.push(stripIndent`
				By default, only one .dockerignore file at the source folder (project root)
				is used. Microservices (multicontainer) applications may use a separate
				.dockerignore file for each service with the --multi-dockerignore (-m) option.
				See "balena help ${Logger.command}" for more details.`);
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
				single-container (non-microservices) apps. Only one .dockerignore file at the
				project source (root) directory, if any, is used. See "balena help ${Logger.command}".`,
			);
		}
	}
	if (msg.length) {
		logFunc.call(logger, [' ', hr, ...msg, hr].join('\n'));
	}
}

/**
 * Print a deprecation warning if any '.gitignore' or '.dockerignore' file is
 * found and the --gitignore (-g) option has been provided (v11 compatibility).
 * @param dockerignoreFile Absolute path to a .dockerignore file
 * @param gitignoreFiles Array of absolute paths to .gitginore files
 */
export function printGitignoreWarn(
	dockerignoreFile: string,
	gitignoreFiles: string[],
) {
	const ignoreFiles = [dockerignoreFile, ...gitignoreFiles].filter((e) => e);
	if (ignoreFiles.length === 0) {
		return;
	}
	const msg = [' ', hr, 'Using file ignore patterns from:'];
	msg.push(...ignoreFiles.map((e) => `* ${e}`));
	if (gitignoreFiles.length) {
		msg.push(stripIndent`
			.gitignore files are being considered because the --gitignore option was used.
			This option is deprecated and will be removed in the next major version release.
			For more information, see 'balena help ${Logger.command}'.
		`);
		msg.push(hr);
		Logger.getLogger().logWarn(msg.join('\n'));
	} else if (dockerignoreFile && process.platform === 'win32') {
		msg.push(stripIndent`
			The --gitignore option was used, but no .gitignore files were found.
			The --gitignore option is deprecated and will be removed in the next major
			version release. It prevents the use of a better dockerignore parser and
			filter library that fixes several issues on Windows and improves compatibility
			with 'docker build'. For more information, see 'balena help ${Logger.command}'.
		`);
		msg.push(hr);
		Logger.getLogger().logWarn(msg.join('\n'));
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
		const dockerUtils = await import('./docker');
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
): Promise<RegistrySecrets> {
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
): Promise<RegistrySecrets> {
	try {
		let isYaml = false;
		if (/.+\.ya?ml$/i.test(secretsFilename)) {
			isYaml = true;
		} else if (!/.+\.json$/i.test(secretsFilename)) {
			throw new ExpectedError('Filename must end with .json, .yml or .yaml');
		}
		const raw = (await fs.readFile(secretsFilename)).toString();
		const registrySecrets = new MultiBuild.RegistrySecretValidator().validateRegistrySecrets(
			isYaml ? require('js-yaml').safeLoad(raw) : JSON.parse(raw),
		);
		MultiBuild.addCanonicalDockerHubEntry(registrySecrets);
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
	const buildTasks = await MultiBuild.splitBuildStream(composition, tarStream);

	logger.logDebug('Found build tasks:');
	_.each(buildTasks, (task) => {
		let infoStr: string;
		if (task.external) {
			infoStr = `image pull [${task.imageName}]`;
		} else {
			infoStr = `build [${task.context}]`;
		}
		logger.logDebug(`    ${task.serviceName}: ${infoStr}`);
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
	const { cloneTarStream } = require('tar-utils');

	return await new Promise<MultiBuild.BuildTask[]>((resolve, reject) => {
		const buildTasks = MultiBuild.performResolution(
			tasks,
			deviceInfo.arch,
			deviceInfo.deviceType,
			{ error: [reject] },
			{
				BALENA_RELEASE_HASH: releaseHash,
				BALENA_APP_NAME: appName,
			},
			preprocessHook,
		);
		// Do one task at a time (Bluebird.each instead of Bluebird.all)
		// in order to reduce peak memory usage. Resolves to buildTasks.
		Bluebird.each(buildTasks, (buildTask) => {
			// buildStream is falsy for "external" tasks (image pull)
			if (!buildTask.buildStream) {
				return buildTask;
			}
			// Consume each task.buildStream in order to trigger the
			// resolution events that define fields like:
			//     task.dockerfile, task.dockerfilePath,
			//     task.projectType, task.resolved
			// This mimics what is currently done in `resin-builder`.
			return cloneTarStream(buildTask.buildStream).then(
				(clonedStream: tar.Pack) => {
					buildTask.buildStream = clonedStream;
					if (!buildTask.external && !buildTask.resolved) {
						throw new ExpectedError(
							`Project type for service "${buildTask.serviceName}" could not be determined. Missing a Dockerfile?`,
						);
					}
					return buildTask;
				},
			);
		}).then(resolve, reject);
	});
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
	const { contains, toNativePath, toPosixPath } = MultiBuild.PathUtils;

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
	registrySecrets: RegistrySecrets;
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
				const { isV12 } = await import('./version');
				const msg = stripIndent`
					"docker-compose.y[a]ml" file found in parent directory: please check that
					the correct source folder was specified. (Suppress with '--noparent-check'.)`;
				if (isV12()) {
					throw new ExpectedError(`Error: ${msg}`);
				} else {
					Logger.getLogger().logWarn(msg);
				}
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
	docker: import('docker-toolbelt'),
	logger: Logger,
	appId: number,
	apiEndpoint: string,
	taggedImages: TaggedImage[],
): Promise<string> {
	logger.logDebug('Authorizing push...');
	const { authorizePush, getPreviousRepos } = await import('./compose');
	const sdk = getBalenaSdk();
	const previousRepos = await getPreviousRepos(sdk, docker, logger, appId);

	const token = await authorizePush(
		sdk,
		apiEndpoint,
		taggedImages[0].registry,
		_.map(taggedImages, 'repo'),
		previousRepos,
	);
	return token;
}

async function pushServiceImages(
	docker: import('docker-toolbelt'),
	logger: Logger,
	pineClient: import('pinejs-client'),
	taggedImages: TaggedImage[],
	token: string,
	skipLogUpload: boolean,
): Promise<void> {
	const { pushAndUpdateServiceImages } = await import('./compose');
	const releaseMod = await import('balena-release');
	logger.logInfo('Pushing images to registry...');
	await pushAndUpdateServiceImages(docker, token, taggedImages, async function (
		serviceImage,
	) {
		logger.logDebug(
			`Saving image ${serviceImage.is_stored_at__image_location}`,
		);
		if (skipLogUpload) {
			delete serviceImage.build_log;
		}
		await releaseMod.updateImage(pineClient, serviceImage.id, serviceImage);
	});
}

export async function deployProject(
	docker: import('docker-toolbelt'),
	logger: Logger,
	composition: import('resin-compose-parse').Composition,
	images: BuiltImage[],
	appId: number,
	userId: number,
	auth: string,
	apiEndpoint: string,
	skipLogUpload: boolean,
): Promise<Partial<import('balena-release/build/models').ReleaseModel>> {
	const releaseMod = require('balena-release');
	const { createRelease, tagServiceImages } = await import('./compose');
	const tty = (await import('./tty'))(process.stdout);

	const prefix = getChalk().cyan('[Info]') + '    ';
	const spinner = createSpinner();
	let runloop = runSpinner(tty, spinner, `${prefix}Creating release...`);

	let $release: Release;
	try {
		$release = await createRelease(
			apiEndpoint,
			auth,
			userId,
			appId,
			composition,
		);
	} finally {
		runloop.end();
	}
	const { client: pineClient, release, serviceImages } = $release;

	try {
		logger.logDebug('Tagging images...');
		const taggedImages = await tagServiceImages(docker, images, serviceImages);
		try {
			const token = await getTokenForPreviousRepos(
				docker,
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
			release.status = 'success';
		} catch (err) {
			release.status = 'failed';
			throw err;
		} finally {
			logger.logDebug('Untagging images...');
			await Bluebird.map(taggedImages, ({ localImage }) => localImage.remove());
		}
	} finally {
		runloop = runSpinner(tty, spinner, `${prefix}Saving release...`);
		release.end_timestamp = new Date();
		if (release.id != null) {
			try {
				await releaseMod.updateRelease(pineClient, release.id, release);
			} finally {
				runloop.end();
			}
		}
	}
	return release;
}

export function createSpinner() {
	const chars = '|/-\\';
	let index = 0;
	return () => chars[index++ % chars.length];
}

function runSpinner(
	tty: ReturnType<typeof import('./tty')>,
	spinner: () => string,
	msg: string,
) {
	const runloop = createRunLoop(function () {
		tty.clearLine();
		tty.writeLine(`${msg} ${spinner()}`);
		return tty.cursorUp();
	});
	runloop.onEnd = function () {
		tty.clearLine();
		return tty.writeLine(msg);
	};
	return runloop;
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
