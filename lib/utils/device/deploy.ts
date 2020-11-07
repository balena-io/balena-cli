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

import * as semver from 'balena-semver';
import * as Docker from 'dockerode';
import * as _ from 'lodash';
import { Composition } from 'resin-compose-parse';
import {
	BuildTask,
	getAuthConfigObj,
	LocalImage,
	RegistrySecrets,
} from 'resin-multibuild';
import type { Readable } from 'stream';

import { BALENA_ENGINE_TMP_PATH } from '../../config';
import {
	checkBuildSecretsRequirements,
	loadProject,
	makeBuildTasks,
	tarDirectory,
} from '../compose_ts';
import Logger = require('../logger');
import { DeviceAPI, DeviceInfo } from './api';
import * as LocalPushErrors from './errors';
import { DeviceAPIError } from './errors';
import LivepushManager from './live';
import { displayBuildLog } from './logs';

const LOCAL_APPNAME = 'localapp';
const LOCAL_RELEASEHASH = 'localrelease';

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
	nogitignore: boolean;
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
	const { exitWithExpectedError } = await import('../../errors');
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
			exitWithExpectedError(`Unable to parse environment variable: ${env}`);
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
	const { exitWithExpectedError } = await import('../../errors');
	const { displayDeviceLogs } = await import('./logs');

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

	const api = new DeviceAPI(globalLogger, opts.deviceHost);

	// First check that we can access the device with a ping
	try {
		globalLogger.logDebug('Checking we can access device');
		await api.ping();
	} catch (e) {
		exitWithExpectedError(
			`Could not communicate with local mode device at address ${opts.deviceHost}`,
		);
	}

	const versionError = new Error(
		'The supervisor version on this remote device does not support multicontainer local mode. ' +
			'Please update your device to balenaOS v2.20.0 or greater from the dashboard.',
	);

	try {
		const version = await api.getVersion();
		globalLogger.logDebug(`Checking device version: ${version}`);
		if (!semver.satisfies(version, '>=7.21.4')) {
			exitWithExpectedError(versionError);
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
		if (e instanceof DeviceAPIError) {
			exitWithExpectedError(versionError);
		} else {
			throw e;
		}
	}

	globalLogger.logInfo(`Starting build on device ${opts.deviceHost}`);

	const project = await loadProject(globalLogger, {
		convertEol: opts.convertEol,
		dockerfilePath: opts.dockerfilePath,
		multiDockerignore: opts.multiDockerignore,
		nogitignore: opts.nogitignore,
		noParentCheck: opts.noParentCheck,
		projectName: 'local',
		projectPath: opts.source,
	});

	// Attempt to attach to the device's docker daemon
	const docker = connectToDocker(
		opts.deviceHost,
		opts.devicePort != null ? opts.devicePort : 2375,
	);

	await checkBuildSecretsRequirements(docker, opts.source);
	globalLogger.logDebug('Tarring all non-ignored files...');
	const tarStream = await tarDirectory(opts.source, {
		composition: project.composition,
		convertEol: opts.convertEol,
		multiDockerignore: opts.multiDockerignore,
		nogitignore: opts.nogitignore,
	});

	// Try to detect the device information
	const deviceInfo = await api.getDeviceInformation();

	let buildLogs: Dictionary<string> | undefined;
	if (!opts.nolive) {
		buildLogs = {};
	}
	const buildTasks = await performBuilds(
		project.composition,
		tarStream,
		docker,
		deviceInfo,
		globalLogger,
		opts,
		buildLogs,
	);

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
	if (!opts.nolive) {
		// Print a newline to clear seperate build time and runtime
		console.log();
		const livepush = new LivepushManager({
			api,
			buildContext: opts.source,
			buildTasks,
			docker,
			logger: globalLogger,
			composition: project.composition,
			buildLogs: buildLogs!,
			deployOpts: opts,
		});

		const promises: Array<Promise<void>> = [livepush.init()];
		// Only show logs if we're not detaching
		if (!opts.detached) {
			const logStream = await api.getLogStream();
			globalLogger.logInfo('Streaming device logs...');
			promises.push(
				displayDeviceLogs(logStream, globalLogger, opts.system, opts.services),
			);
		} else {
			globalLogger.logLivepush(
				'Running in detached mode, no service logs will be shown',
			);
		}
		globalLogger.logLivepush('Watching for file changes...');
		globalLogger.outputDeferredMessages();
		await Promise.all(promises);

		livepush.close();
	} else {
		if (opts.detached) {
			return;
		}
		// Print an empty newline to separate the build output
		// from the device output
		console.log();
		// Now all we need to do is stream back the logs
		const logStream = await api.getLogStream();
		globalLogger.logInfo('Streaming device logs...');
		globalLogger.outputDeferredMessages();
		await displayDeviceLogs(
			logStream,
			globalLogger,
			opts.system,
			opts.services,
		);
	}
}

function connectToDocker(host: string, port: number): Docker {
	return new Docker({
		host,
		port,
		Promise: require('bluebird'),
	});
}

export async function performBuilds(
	composition: Composition,
	tarStream: Readable,
	docker: Docker,
	deviceInfo: DeviceInfo,
	logger: Logger,
	opts: DeviceDeployOptions,
	buildLogs?: Dictionary<string>,
): Promise<BuildTask[]> {
	const multibuild = await import('resin-multibuild');

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
	if (buildLogs != null) {
		for (const task of buildTasks) {
			if (!task.external) {
				buildLogs[task.serviceName] = '';
			}
		}
		logHandlers = (serviceName: string, line: string) => {
			buildLogs[serviceName] += `${line}\n`;
		};
	}

	logger.logDebug('Starting builds...');
	await assignOutputHandlers(buildTasks, logger, logHandlers);
	const localImages = await multibuild.performBuilds(
		buildTasks,
		docker,
		BALENA_ENGINE_TMP_PATH,
	);

	// Check for failures
	await inspectBuildResults(localImages);

	const imagesToRemove: string[] = [];

	// Now tag any external images with the correct name that they should be,
	// as this won't be done by resin-multibuild
	await Promise.all(
		localImages.map(async (localImage) => {
			if (localImage.external) {
				// We can be sure that localImage.name is set here, because of the failure code above
				const image = docker.getImage(localImage.name!);
				await image.tag({
					repo: generateImageName(localImage.serviceName),
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
): Promise<string> {
	const multibuild = await import('resin-multibuild');
	// First we run the build task, to get the new image id
	let buildLogs = '';
	const logHandler = (_s: string, line: string) => {
		buildLogs += `${line}\n`;

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
		nogitignore: opts.nogitignore,
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
		throw new Error(`Could not find build task for service ${serviceName}`);
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

	return buildLogs;
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
				cachefrom: images,
				labels: {
					'io.resin.local.image': '1',
					'io.resin.local.service': task.serviceName,
				},
				t: generateImageName(task.serviceName),
				nocache: opts.nocache,
				forcerm: true,
				pull: opts.pull,
			};
			if (task.external) {
				task.dockerOpts.authconfig = await getAuthConfigObj(
					task.imageName!,
					opts.registrySecrets,
				);
			} else {
				task.dockerOpts.registryconfig = opts.registrySecrets;
			}
		}),
	);
}

function generateImageName(serviceName: string): string {
	return `local_image_${serviceName}:latest`;
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
		// This function can be called with a subset of the
		// build tasks, when a single dockerfile has changed
		// when livepushing, so check the build task exists for
		// this composition entry (everything else in this
		// function comes from the composition which doesn't
		// change)
		let contract;
		if (name in keyedBuildTasks) {
			contract = keyedBuildTasks[name].contract;
		}

		services[idx] = {
			...defaults,
			...opts,
			...(contract != null ? { contract } : {}),
			...{
				imageId: idx,
				serviceName: name,
				serviceId: idx,
				image: generateImageName(name),
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
	const { exitWithExpectedError } = await import('../../errors');

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
		exitWithExpectedError(new LocalPushErrors.BuildError(failures).toString());
	}
}
