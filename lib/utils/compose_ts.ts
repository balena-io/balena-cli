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
import * as _ from 'lodash';
import { Composition } from 'resin-compose-parse';
import * as MultiBuild from 'resin-multibuild';
import { Readable } from 'stream';
import * as tar from 'tar-stream';

import { DeviceInfo } from './device/api';
import Logger = require('./logger');

export interface RegistrySecrets {
	[registryAddress: string]: {
		username: string;
		password: string;
	};
}

export async function parseRegistrySecrets(
	secretsFilename: string,
): Promise<RegistrySecrets> {
	const { fs } = await import('mz');
	const { exitWithExpectedError } = await import('../utils/patterns');
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
export async function validateComposeOptions(options: { [opt: string]: any }) {
	if (options['registry-secrets']) {
		options['registry-secrets'] = await parseRegistrySecrets(
			options['registry-secrets'],
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
	const { exitWithExpectedError } = require('../utils/patterns');
	const { isAbsolute, join, normalize, parse, posix } = require('path');
	const { existsSync } = require('fs');
	const { stripIndent } = require('common-tags');
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
