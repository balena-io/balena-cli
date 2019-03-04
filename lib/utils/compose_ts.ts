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
import * as _ from 'lodash';
import * as Bluebird from 'bluebird';
import * as tar from 'tar-stream';
import { Readable } from 'stream';

import * as MultiBuild from 'resin-multibuild';
import { Composition } from 'resin-compose-parse';

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
