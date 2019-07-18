/**
 * @license
 * Copyright 2018 Balena Ltd.
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
import { stripIndent } from 'common-tags';
import Dockerode = require('dockerode');
import * as _ from 'lodash';
import { Composition } from 'resin-compose-parse';
import * as MultiBuild from 'resin-multibuild';
import { Readable } from 'stream';
import * as tar from 'tar-stream';

import { BalenaSDK } from 'balena-sdk';
import { DeviceInfo } from './device/api';
import Logger = require('./logger');
import { exitWithExpectedError } from './patterns';

export interface RegistrySecrets {
	[registryAddress: string]: {
		username: string;
		password: string;
	};
}

/**
 * Load the ".balena/balena.yml" file (or resin.yml, or yaml or json),
 * which contains "build metadata" for features like "build secrets" and
 * "build variables".
 * @returns Pair of metadata object and metadata file path
 */
export async function loadBuildMetatada(
	sourceDir: string,
): Promise<[MultiBuild.ParsedBalenaYml, string]> {
	const { fs } = await import('mz');
	const path = await import('path');
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
		return exitWithExpectedError(
			`Error parsing file "${metadataPath}":\n ${err.message}`,
		);
	}
	return [buildMetadata, metadataPath];
}

/**
 * Check whether the "build secrets" feature is being used and, if so,
 * verify that the target docker daemon is balenaEngine. If the
 * requirement is not satisfied, call exitWithExpectedError().
 * @param docker Dockerode instance
 * @param sourceDir Project directory where to find .balena/balena.yml
 */
export async function checkBuildSecretsRequirements(
	docker: Dockerode,
	sourceDir: string,
) {
	const [metaObj, metaFilename] = await loadBuildMetatada(sourceDir);
	if (!_.isEmpty(metaObj['build-secrets'])) {
		const dockerUtils = await import('./docker');
		const isBalenaEngine = await dockerUtils.isBalenaEngine(docker);
		if (!isBalenaEngine) {
			exitWithExpectedError(stripIndent`
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
	const { fs } = await import('mz');
	const Path = await import('path');

	if (inputFilename != null) {
		return await parseRegistrySecrets(inputFilename);
	}

	const directory = await sdk.settings.get('dataDirectory');
	const potentialPaths = [
		Path.join(directory, 'secrets.yml'),
		Path.join(directory, 'secrets.yaml'),
		Path.join(directory, 'secrets.json'),
	];

	for (const path of potentialPaths) {
		if (await fs.exists(path)) {
			return await parseRegistrySecrets(path);
		}
	}

	return {};
}

async function parseRegistrySecrets(
	secretsFilename: string,
): Promise<RegistrySecrets> {
	const { fs } = await import('mz');
	try {
		let isYaml = false;
		if (/.+\.ya?ml$/i.test(secretsFilename)) {
			isYaml = true;
		} else if (!/.+\.json$/i.test(secretsFilename)) {
			throw new Error('Filename must end with .json, .yml or .yaml');
		}
		const raw = (await fs.readFile(secretsFilename)).toString();
		const registrySecrets = new MultiBuild.RegistrySecretValidator().validateRegistrySecrets(
			isYaml ? require('js-yaml').safeLoad(raw) : JSON.parse(raw),
		);
		MultiBuild.addCanonicalDockerHubEntry(registrySecrets);
		return registrySecrets;
	} catch (error) {
		return exitWithExpectedError(
			`Error validating registry secrets file "${secretsFilename}":\n${
				error.message
			}`,
		);
	}
}

/**
 * Validate the compose-specific command-line options defined in compose.coffee.
 * This function is meant to be called very early on to validate users' input,
 * before any project loading / building / deploying.
 */
export async function validateComposeOptions(
	sdk: BalenaSDK,
	options: { [opt: string]: any },
) {
	options['registry-secrets'] = await getRegistrySecrets(
		sdk,
		options['registry-secrets'],
	);
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
): Promise<MultiBuild.BuildTask[]> {
	const buildTasks = await MultiBuild.splitBuildStream(composition, tarStream);

	logger.logDebug('Found build tasks:');
	_.each(buildTasks, task => {
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

	await performResolution(buildTasks, deviceInfo);

	logger.logDebug('Found project types:');
	_.each(buildTasks, task => {
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
): Promise<MultiBuild.BuildTask[]> {
	const { cloneTarStream } = require('tar-utils');

	return await new Promise<MultiBuild.BuildTask[]>((resolve, reject) => {
		const buildTasks = MultiBuild.performResolution(
			tasks,
			deviceInfo.arch,
			deviceInfo.deviceType,
			{ error: [reject] },
		);
		// Do one task at a time (Bluebird.each instead of Bluebird.all)
		// in order to reduce peak memory usage. Resolves to buildTasks.
		Bluebird.each(buildTasks, buildTask => {
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
						throw new Error(
							`Project type for service "${
								buildTask.serviceName
							}" could not be determined. Missing a Dockerfile?`,
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
 * @param projectPath The project source folder (-s command-line option)
 * @param dockerfilePath The alternative Dockerfile specified by the user
 */
export function validateSpecifiedDockerfile(
	projectPath: string,
	dockerfilePath: string = '',
): string {
	if (!dockerfilePath) {
		return dockerfilePath;
	}
	const { isAbsolute, join, normalize, parse, posix } = require('path');
	const { existsSync } = require('fs');
	const { contains, toNativePath, toPosixPath } = MultiBuild.PathUtils;

	// reminder: native windows paths may start with a drive specificaton,
	// e.g. 'C:\absolute' or 'C:relative'.
	if (isAbsolute(dockerfilePath) || posix.isAbsolute(dockerfilePath)) {
		exitWithExpectedError(stripIndent`
			Error: absolute Dockerfile path detected:
			"${dockerfilePath}"
			The Dockerfile path should be relative to the source folder.
		`);
	}
	const nativeProjectPath = normalize(projectPath);
	const nativeDockerfilePath = join(projectPath, toNativePath(dockerfilePath));

	if (!contains(nativeProjectPath, nativeDockerfilePath)) {
		// Note that testing the existence of nativeDockerfilePath in the
		// filesystem (after joining its path to the source folder) is not
		// sufficient, because the user could have added '../' to the path.
		exitWithExpectedError(stripIndent`
			Error: the specified Dockerfile must be in a subfolder of the source folder:
			Specified dockerfile: "${nativeDockerfilePath}"
			Source folder: "${nativeProjectPath}"
		`);
	}

	if (!existsSync(nativeDockerfilePath)) {
		exitWithExpectedError(stripIndent`
			Error: Dockerfile not found: "${nativeDockerfilePath}"
		`);
	}

	const { dir, ext, name } = parse(nativeDockerfilePath);
	if (ext) {
		const nativePathMinusExt = join(dir, name);

		if (existsSync(nativePathMinusExt)) {
			exitWithExpectedError(stripIndent`
				Error: "${name}" exists on the same folder as "${dockerfilePath}".
				When an alternative Dockerfile name is specified, a file with the same
				base name (minus the file extension) must not exist in the same folder.
				This is because the base name file will be auto generated and added to
				the tar stream that is sent to the docker daemon, resulting in duplicate
				Dockerfiles and undefined behavior.
			`);
		}
	}
	return posix.normalize(toPosixPath(dockerfilePath));
}

export async function tarDirectory(
	dir: string,
	preFinalizeCallback?: (pack: tar.Pack) => void,
): Promise<tar.Pack> {
	dir = (await import('path')).resolve(dir);
	const klaw = await import('klaw');
	const { getKlawStreamFilterForDockerIgnore } = await import('./ignore');
	const streamFilter = await getKlawStreamFilterForDockerIgnore(dir);
	const pack = tar.pack();

	return await new Promise((resolve, reject) => {
		// Note regarding klaw's 'options' argument:
		//
		// * options.filter allows early pruning of parent directories, so that
		//   subfolders aren't even visited. It would be a nice performance
		//   improvement, but we don't use it because the dockerignore file
		//   (unlike gitignore) allows "re-adding" subfolders/files with the
		//   exclamation mark "except for" pattern. For example, "ignore '.git'
		//   except for '.git/foo.txt'":
		//       .git
		//       !.git/foo.txt
		//
		// * options.preserveSymlinks: we don't preserve symlinks in the tar
		//   stream because "there is no point": the Docker daemon (or
		//   balenaEngine) will not preserve the symlinks when executing the
		//   COPY or ADD instructions in a Dockerfile. See also CLI issue 1169:
		//   https://github.com/balena-io/balena-cli/issues/1169
		//
		klaw(dir)
			.on('error', reject)
			.pipe(streamFilter)
			.on('error', reject)
			.on('data', (item: import('./ignore').KlawItemPlus) => {
				const header: tar.Headers = {
					mode: item.stats.mode,
					mtime: item.stats.mtime,
					name: item.path, // already relative and Posix (forward slashes)
					size: item.stats.size,
				};
				pack.entry(header, item.data);
			})
			.on('end', async () => {
				if (preFinalizeCallback) {
					try {
						await preFinalizeCallback(pack);
					} catch (err) {
						exitWithExpectedError(err);
					}
				}
				pack.finalize();
				resolve(pack);
			});
	});
}
