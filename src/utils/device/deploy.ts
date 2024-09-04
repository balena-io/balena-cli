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

import * as semver from 'balena-semver';
import Docker from 'dockerode';
import _ from 'lodash';
import type { Composition } from '@balena/compose/dist/parse';
import type {
	BuildTask,
	LocalImage,
	RegistrySecrets,
} from '@balena/compose/dist/multibuild';
import { getAuthConfigObj } from '@balena/compose/dist/multibuild';
import type { Readable } from 'stream';

import { BALENA_ENGINE_TMP_PATH } from '../../config.js';
import { ExpectedError } from '../../errors.js';
import {
	checkBuildSecretsRequirements,
	loadProject,
	makeBuildTasks,
	tarDirectory,
	makeImageName,
} from '../compose_ts.js';
import Logger from '../logger.js';
import type { DeviceInfo } from './api.js';
import { DeviceAPI } from './api.js';
import * as LocalPushErrors from './errors.js';
import LivepushManager from './live.js';
import { displayBuildLog } from './logs.js';
import { stripIndent } from '../lazy.js';

const LOCAL_APPNAME = 'localapp';
const LOCAL_RELEASEHASH = '10ca12e1ea5e';
const LOCAL_PROJECT_NAME = 'local_image';

// Define the logger here so the debug output
// can be used everywhere
const globalLogger = Logger.getLogger();

export interface DeviceDeployOptions {
	source: string;
	deviceHost: string;
	devicePort?: number;
	dockerfilePath?: string;
	registrySecrets: RegistrySecrets;
	multiDockerignore: boolean;
	nocache: boolean;
	noParentCheck: boolean;
	nolive: boolean;
	pull: boolean;
	detached: boolean;
	services?: string[];
	system: boolean;
	env: string[];
	convertEol: boolean;
}

interface ParsedEnvironment {
	[serviceName: string]: { [key: string]: string };
}

async function environmentFromInput(
	envs: string[],
	serviceNames: string[],
	logger: Logger,
): Promise<ParsedEnvironment> {
	// A normal environment variable regex, with an added part
	// to find a colon followed servicename at the start
	const varRegex = /^(?:([^\s:]+):)?([^\s]+?)=(.*)$/;

	const ret: ParsedEnvironment = {};
	// Populate the object with the servicenames, as it
	// also means that we can do a fast lookup of whether a
	// service exists
	for (const service of serviceNames) {
		ret[service] = {};
	}

	for (const env of envs) {
		const maybeMatch = env.match(varRegex);
		if (maybeMatch == null) {
			throw new ExpectedError(`Unable to parse environment variable: ${env}`);
		}
		const match = maybeMatch!;
		let service: string | undefined;
		if (match[1]) {
			// This is for a service, we check that it actually
			// exists
			if (!(match[1] in ret)) {
				logger.logDebug(
					`Warning: Cannot find a service with name ${match[1]}. Treating the string as part of the environment variable name.`,
				);
				match[2] = `${match[1]}:${match[2]}`;
			} else {
				service = match[1];
			}
		}

		if (service != null) {
			ret[service][match[2]] = match[3];
		} else {
			for (const serviceName of serviceNames) {
				ret[serviceName][match[2]] = match[3];
			}
		}
	}

	return ret;
}

export async function deployToDevice(opts: DeviceDeployOptions): Promise<void> {
	// Resolve .local addresses to IP to avoid
	// issue with Windows and rapid repeat lookups.
	// see: https://github.com/balena-io/balena-cli/issues/1518
	if (opts.deviceHost.includes('.local')) {
		const util = await import('util');
		const dns = await import('dns');
		const { address } = await util.promisify(dns.lookup)(opts.deviceHost, {
			family: 4,
		});
		opts.deviceHost = address;
	}

	const port = 48484;
	const api = new DeviceAPI(globalLogger, opts.deviceHost, port);

	// First check that we can access the device with a ping
	try {
		globalLogger.logDebug('Checking we can access device');
		await api.ping();
	} catch (e) {
		throw new ExpectedError(stripIndent`
			Could not communicate with device supervisor at address ${opts.deviceHost}:${port}.
			Device may not have local mode enabled. Check with:
			  balena device local-mode <device-uuid>
		`);
	}

	const versionError = new Error(
		'The supervisor version on this remote device does not support multicontainer local mode. ' +
			'Please update your device to balenaOS v2.20.0 or greater from the dashboard.',
	);

	try {
		const version = await api.getVersion();
		globalLogger.logDebug(`Checking device supervisor version: ${version}`);
		if (!semver.satisfies(version, '>=7.21.4')) {
			throw new ExpectedError(versionError);
		}
		if (!opts.nolive && !semver.satisfies(version, '>=9.7.0')) {
			globalLogger.logWarn(
				`Using livepush requires a balena supervisor version >= 9.7.0. A live session will not be started.`,
			);
			opts.nolive = true;
		}
	} catch (e) {
		// Very old supervisor versions do not support /version endpoint
		// a DeviceAPIError is expected in this case
		if (e instanceof LocalPushErrors.DeviceAPIError) {
			throw new ExpectedError(versionError);
		} else {
			throw e;
		}
	}

	globalLogger.logInfo(`Starting build on device ${opts.deviceHost}`);

	const project = await loadProject(globalLogger, {
		convertEol: opts.convertEol,
		dockerfilePath: opts.dockerfilePath,
		multiDockerignore: opts.multiDockerignore,
		noParentCheck: opts.noParentCheck,
		projectName: 'local',
		projectPath: opts.source,
		isLocal: true,
	});

	// Attempt to attach to the device's docker daemon
	const docker = connectToDocker(
		opts.deviceHost,
		opts.devicePort != null ? opts.devicePort : 2375,
	);

	await checkBuildSecretsRequirements(docker, opts.source);
	globalLogger.logDebug('Tarring all non-ignored files...');
	const tarStartTime = Date.now();
	const tarStream = await tarDirectory(opts.source, {
		composition: project.composition,
		convertEol: opts.convertEol,
		multiDockerignore: opts.multiDockerignore,
	});
	globalLogger.logDebug(`Tarring complete in ${Date.now() - tarStartTime} ms`);

	// Try to detect the device information
	globalLogger.logDebug('Fetching device information...');
	const deviceInfo = await api.getDeviceInformation();

	let imageIds: Dictionary<string[]> | undefined;
	if (!opts.nolive) {
		imageIds = {};
	}

	const { awaitInterruptibleTask } = await import('../helpers.js');
	const buildTasks = await awaitInterruptibleTask<typeof performBuilds>(
		performBuilds,
		project.composition,
		tarStream,
		docker,
		deviceInfo,
		globalLogger,
		opts,
		imageIds,
	);

	globalLogger.outputDeferredMessages();
	// Print a newline to clearly separate build time and runtime
	console.log();

	const envs = await environmentFromInput(
		opts.env,
		Object.getOwnPropertyNames(project.composition.services),
		globalLogger,
	);

	globalLogger.logDebug('Setting device state...');
	// Now set the target state on the device

	const currentTargetState = await api.getTargetState();

	const targetState = generateTargetState(
		currentTargetState,
		project.composition,
		buildTasks,
		envs,
	);
	globalLogger.logDebug(`Sending target state: ${JSON.stringify(targetState)}`);

	await api.setTargetState(targetState);

	// Now that we've set the target state, the device will do it's thing
	// so we can either just display the logs, or start a livepush session
	// (whilst also display logs)
	const promises: Array<Promise<void>> = [streamDeviceLogs(api, opts)];
	let livepush: LivepushManager | null = null;

	if (!opts.nolive) {
		livepush = new LivepushManager({
			api,
			buildContext: opts.source,
			buildTasks,
			docker,
			logger: globalLogger,
			composition: project.composition,
			imageIds: imageIds!,
			deployOpts: opts,
		});
		promises.push(livepush.init());
		if (opts.detached) {
			globalLogger.logLivepush(
				'Running in detached mode, no service logs will be shown',
			);
		}
		globalLogger.logLivepush('Watching for file changes...');
	}
	try {
		await awaitInterruptibleTask(() => Promise.all(promises));
	} finally {
		// Stop watching files after log streaming ends (e.g. on SIGINT)
		livepush?.close();
		await livepush?.cleanup();
	}
}

async function streamDeviceLogs(
	deviceApi: DeviceAPI,
	opts: DeviceDeployOptions,
) {
	// Only show logs if we're not detaching
	if (opts.detached) {
		return;
	}
	globalLogger.logInfo('Streaming device logs...');
	const { connectAndDisplayDeviceLogs } = await import('./logs.js');
	return connectAndDisplayDeviceLogs({
		deviceApi,
		logger: globalLogger,
		system: opts.system || false,
		filterServices: opts.services,
		maxAttempts: 1001,
	});
}

function connectToDocker(host: string, port: number): Docker {
	return new Docker({
		host,
		port,
		Promise: require('bluebird'),
	});
}

function extractDockerArrowMessage(outputLine: string): string | undefined {
	const arrowTest = /^.*\s*-+>\s*(.+)/i;
	const match = arrowTest.exec(outputLine);
	if (match != null) {
		return match[1];
	}
}

async function performBuilds(
	composition: Composition,
	tarStream: Readable,
	docker: Docker,
	deviceInfo: DeviceInfo,
	logger: Logger,
	opts: DeviceDeployOptions,
	imageIds?: Dictionary<string[]>,
): Promise<BuildTask[]> {
	const multibuild = await import('@balena/compose/dist/multibuild');

	const buildTasks = await makeBuildTasks(
		composition,
		tarStream,
		deviceInfo,
		logger,
		LOCAL_APPNAME,
		LOCAL_RELEASEHASH,
		(content) => {
			if (!opts.nolive) {
				return LivepushManager.preprocessDockerfile(content);
			} else {
				return content;
			}
		},
	);

	logger.logDebug('Probing remote daemon for cache images');
	await assignDockerBuildOpts(docker, buildTasks, opts);

	// If we're passed a build logs object make sure to set it
	// up properly
	let logHandlers: ((serviceName: string, line: string) => void) | undefined;

	const lastArrowMessage: Dictionary<string> = {};

	if (imageIds != null) {
		for (const task of buildTasks) {
			if (!task.external) {
				imageIds[task.serviceName] = [];
			}
		}
		logHandlers = (serviceName: string, line: string) => {
			// If this was a from line, take the last found
			// image id and save it
			if (
				/step \d+(?:\/\d+)?\s*:\s*FROM/i.test(line) &&
				lastArrowMessage[serviceName] != null
			) {
				imageIds[serviceName].push(lastArrowMessage[serviceName]);
			} else {
				const msg = extractDockerArrowMessage(line);
				if (msg != null) {
					lastArrowMessage[serviceName] = msg;
				}
			}
		};
	}

	logger.logDebug('Starting builds...');
	assignOutputHandlers(buildTasks, logger, logHandlers);
	const localImages = await multibuild.performBuilds(
		buildTasks,
		docker,
		BALENA_ENGINE_TMP_PATH,
	);

	// Check for failures
	await inspectBuildResults(localImages);

	const imagesToRemove: string[] = [];

	// Now tag any external images with the correct name that they should be,
	// as this won't be done by @balena/compose/multibuild
	await Promise.all(
		localImages.map(async (localImage) => {
			if (localImage.external) {
				// We can be sure that localImage.name is set here, because of the failure code above
				const image = docker.getImage(localImage.name!);
				await image.tag({
					repo: makeImageName(
						LOCAL_PROJECT_NAME,
						localImage.serviceName,
						'latest',
					),
					force: true,
				});
				imagesToRemove.push(localImage.name!);
			}
		}),
	);

	await Promise.all(
		_.uniq(imagesToRemove).map((image) =>
			docker.getImage(image).remove({ force: true }),
		),
	);

	return buildTasks;
}

// Rebuild a single container, execute it on device, and
// return the build logs
export async function rebuildSingleTask(
	serviceName: string,
	docker: Docker,
	logger: Logger,
	deviceInfo: DeviceInfo,
	composition: Composition,
	source: string,
	opts: DeviceDeployOptions,
	// To cancel a running build, you must first find the
	// container id that it's running in. This is printed in
	// the logs, so any calller who wants to keep track of
	// this should provide the following callback
	containerIdCb?: (id: string) => void,
): Promise<string[]> {
	const multibuild = await import('@balena/compose/dist/multibuild');
	// First we run the build task, to get the new image id
	const stageIds = [] as string[];
	let lastArrowMessage: string | undefined;

	const logHandler = (_s: string, line: string) => {
		// If this was a FROM line, take the last found
		// image id and save it as a stage id
		if (
			/step \d+(?:\/\d+)?\s*:\s*FROM/i.test(line) &&
			lastArrowMessage != null
		) {
			stageIds.push(lastArrowMessage);
		} else {
			const msg = extractDockerArrowMessage(line);
			if (msg != null) {
				lastArrowMessage = msg;
			}
		}

		if (containerIdCb != null) {
			const match = line.match(/^\s*--->\s*Running\s*in\s*([a-f0-9]*)\s*$/i);
			if (match != null) {
				containerIdCb(match[1]);
			}
		}
	};

	const tarStream = await tarDirectory(source, {
		composition,
		convertEol: opts.convertEol,
		multiDockerignore: opts.multiDockerignore,
	});

	const task = _.find(
		await makeBuildTasks(
			composition,
			tarStream,
			deviceInfo,
			logger,
			LOCAL_APPNAME,
			LOCAL_RELEASEHASH,
			(content) => {
				if (!opts.nolive) {
					return LivepushManager.preprocessDockerfile(content);
				} else {
					return content;
				}
			},
		),
		{ serviceName },
	);

	if (task == null) {
		throw new ExpectedError(
			`Could not find build task for service ${serviceName}`,
		);
	}

	await assignDockerBuildOpts(docker, [task], opts);
	await assignOutputHandlers([task], logger, logHandler);

	const [localImage] = await multibuild.performBuilds(
		[task],
		docker,
		BALENA_ENGINE_TMP_PATH,
	);

	if (!localImage.successful) {
		throw new LocalPushErrors.BuildError([
			{
				error: localImage.error!,
				serviceName,
			},
		]);
	}

	return stageIds;
}

function assignOutputHandlers(
	buildTasks: BuildTask[],
	logger: Logger,
	logCb?: (serviceName: string, line: string) => void,
) {
	_.each(buildTasks, (task) => {
		if (task.external) {
			task.progressHook = (progressObj) => {
				displayBuildLog(
					{ serviceName: task.serviceName, message: progressObj.progress },
					logger,
				);
			};
		} else {
			task.streamHook = (stream) => {
				stream.on('data', (buf: Buffer) => {
					const str = _.trimEnd(buf.toString());
					if (str !== '') {
						displayBuildLog(
							{ serviceName: task.serviceName, message: str },
							logger,
						);

						if (logCb) {
							logCb(task.serviceName, str);
						}
					}
				});
			};
		}
	});
}

async function getDeviceDockerImages(docker: Docker): Promise<string[]> {
	const images = await docker.listImages({ all: true });
	return _.map(images, 'Id');
}

// Mutates buildTasks
async function assignDockerBuildOpts(
	docker: Docker,
	buildTasks: BuildTask[],
	opts: DeviceDeployOptions,
): Promise<void> {
	// Get all of the images on the remote docker daemon, so
	// that we can use all of them for cache
	const images = await getDeviceDockerImages(docker);

	globalLogger.logDebug(`Using ${images.length} on-device images for cache...`);

	await Promise.all(
		buildTasks.map(async (task: BuildTask) => {
			task.dockerOpts = {
				...(task.dockerOpts || {}),
				...{
					cachefrom: images,
					labels: {
						'io.resin.local.image': '1',
						'io.resin.local.service': task.serviceName,
					},
					t: getImageNameFromTask(task),
					nocache: opts.nocache,
					forcerm: true,
					pull: opts.pull,
				},
				t: getImageNameFromTask(task),
				nocache: opts.nocache,
				forcerm: true,
				pull: opts.pull,
			};
			if (task.external) {
				task.dockerOpts.authconfig = getAuthConfigObj(
					task.imageName!,
					opts.registrySecrets,
				);
			} else {
				task.dockerOpts.registryconfig = opts.registrySecrets;
			}
		}),
	);
}

function getImageNameFromTask(task: BuildTask): string {
	return !task.external && task.tag
		? task.tag
		: makeImageName(LOCAL_PROJECT_NAME, task.serviceName, 'latest');
}

export function generateTargetState(
	currentTargetState: any,
	composition: Composition,
	buildTasks: BuildTask[],
	env: ParsedEnvironment,
): any {
	const keyedBuildTasks = _.keyBy(buildTasks, 'serviceName');

	const services: { [serviceId: string]: any } = {};
	let idx = 1;
	_.each(composition.services, (opts, name) => {
		// Get rid of any build specific stuff
		opts = _.cloneDeep(opts);
		delete opts.build;
		delete opts.image;

		const defaults = {
			environment: {},
			labels: {},
		};

		opts.environment = _.merge(opts.environment, env[name]);
		// This function should always be called with all the build tasks
		// so we can construct the correct target state so we don't really need
		// to check that the key exists on the `keyedBuildTasks` object
		const contract = keyedBuildTasks[name].contract;
		const task = keyedBuildTasks[name];

		services[idx] = {
			...defaults,
			...opts,
			...(contract != null ? { contract } : {}),
			...{
				imageId: idx,
				serviceName: name,
				serviceId: idx,
				image: getImageNameFromTask(task),
				running: true,
			},
		};
		idx += 1;
	});

	const targetState = _.cloneDeep(currentTargetState);
	delete targetState.local.apps;

	targetState.local.apps = {
		1: {
			name: LOCAL_APPNAME,
			commit: LOCAL_RELEASEHASH,
			releaseId: '1',
			services,
			volumes: composition.volumes || {},
			networks: composition.networks || {},
		},
	};

	return targetState;
}

async function inspectBuildResults(images: LocalImage[]): Promise<void> {
	const failures: LocalPushErrors.BuildFailure[] = [];

	_.each(images, (image) => {
		if (!image.successful) {
			failures.push({
				error: image.error!,
				serviceName: image.serviceName,
			});
		}
	});

	if (failures.length > 0) {
		throw new LocalPushErrors.BuildError(failures).toString();
	}
}
