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
import * as Docker from 'dockerode';
import * as _ from 'lodash';
import { Composition } from 'resin-compose-parse';
import {
	BuildTask,
	getAuthConfigObj,
	LocalImage,
	RegistrySecrets,
} from 'resin-multibuild';
import * as semver from 'resin-semver';
import { Readable } from 'stream';

import { makeBuildTasks } from '../compose_ts';
import Logger = require('../logger');
import { DeviceAPI, DeviceInfo } from './api';
import * as LocalPushErrors from './errors';
import LivepushManager from './live';
import { displayBuildLog } from './logs';

// Define the logger here so the debug output
// can be used everywhere
const globalLogger = new Logger();

export interface DeviceDeployOptions {
	source: string;
	deviceHost: string;
	devicePort?: number;
	dockerfilePath?: string;
	registrySecrets: RegistrySecrets;
	nocache: boolean;
	live: boolean;
	detached: boolean;
	service?: string;
	system: boolean;
}

async function checkSource(source: string): Promise<boolean> {
	const { fs } = await import('mz');
	return (await fs.exists(source)) && (await fs.stat(source)).isDirectory();
}

export async function deployToDevice(opts: DeviceDeployOptions): Promise<void> {
	const { loadProject, tarDirectory } = await import('../compose');
	const { exitWithExpectedError } = await import('../patterns');

	const { displayDeviceLogs } = await import('./logs');

	if (!(await checkSource(opts.source))) {
		exitWithExpectedError(`Could not access source directory: ${opts.source}`);
	}

	const api = new DeviceAPI(globalLogger, opts.deviceHost);

	// First check that we can access the device with a ping
	try {
		globalLogger.logDebug('Checking we can access device');
		await api.ping();
	} catch (e) {
		exitWithExpectedError(
			`Could not communicate with local mode device at address ${
				opts.deviceHost
			}`,
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
		if (opts.live && !semver.satisfies(version, '>=9.7.0')) {
			exitWithExpectedError(
				new Error('Using livepush requires a supervisor >= v9.7.0'),
			);
		}
	} catch {
		exitWithExpectedError(versionError);
	}

	globalLogger.logInfo(`Starting build on device ${opts.deviceHost}`);

	const project = await loadProject(
		globalLogger,
		opts.source, // project path
		'local', // project name
		undefined, // name of a pre-built image
		opts.dockerfilePath, // alternative Dockerfile; OK to be undefined
	);

	// Attempt to attach to the device's docker daemon
	const docker = connectToDocker(
		opts.deviceHost,
		opts.devicePort != null ? opts.devicePort : 2375,
	);

	const tarStream = await tarDirectory(opts.source);

	// Try to detect the device information
	const deviceInfo = await api.getDeviceInformation();

	let buildLogs: Dictionary<string> | undefined;
	if (opts.live) {
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

	globalLogger.logDebug('Setting device state...');
	// Now set the target state on the device

	const currentTargetState = await api.getTargetState();

	const targetState = generateTargetState(
		currentTargetState,
		project.composition,
	);
	globalLogger.logDebug(`Sending target state: ${JSON.stringify(targetState)}`);

	await api.setTargetState(targetState);

	// Now that we've set the target state, the device will do it's thing
	// so we can either just display the logs, or start a livepush session
	// (whilst also display logs)
	if (opts.live) {
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

		globalLogger.logLivepush('Watching for file changes...');
		const promises: Array<Bluebird<void> | Promise<void>> = [livepush.init()];
		// Only show logs if we're not detaching
		if (!opts.detached) {
			console.log();
			const logStream = await api.getLogStream();
			globalLogger.logInfo('Streaming device logs...');
			promises.push(
				displayDeviceLogs(logStream, globalLogger, opts.system, opts.service),
			);
		} else {
			globalLogger.logLivepush(
				'Running in detached mode, no service logs will be shown',
			);
		}
		globalLogger.logLivepush('Watching for file changes...');
		await Promise.all(promises);
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
		await displayDeviceLogs(logStream, globalLogger, opts.system, opts.service);
	}
}

function connectToDocker(host: string, port: number): Docker {
	return new Docker({
		host,
		port,
		Promise: Bluebird as any,
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
	);

	logger.logDebug('Probing remote daemon for cache images');
	await assignDockerBuildOpts(docker, buildTasks, opts);

	logger.logDebug('Starting builds...');
	await assignOutputHandlers(buildTasks, logger, buildLogs);
	const localImages = await multibuild.performBuilds(buildTasks, docker);

	// Check for failures
	await inspectBuildResults(localImages);

	// Now tag any external images with the correct name that they should be,
	// as this won't be done by resin-multibuild
	await Bluebird.map(localImages, async localImage => {
		if (localImage.external) {
			// We can be sure that localImage.name is set here, because of the failure code above
			const image = docker.getImage(localImage.name!);
			await image.tag({
				repo: generateImageName(localImage.serviceName),
				force: true,
			});
			await image.remove({ force: true });
		}
	});

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
): Promise<string> {
	const { tarDirectory } = await import('../compose');
	const multibuild = await import('resin-multibuild');
	// First we run the build task, to get the new image id
	const buildLogs: Dictionary<string> = {};

	const tarStream = await tarDirectory(source);

	const task = _.find(
		await makeBuildTasks(composition, tarStream, deviceInfo, logger),
		{ serviceName },
	);

	if (task == null) {
		throw new Error(`Could not find build task for service ${serviceName}`);
	}

	await assignDockerBuildOpts(docker, [task], opts);
	await assignOutputHandlers([task], logger, buildLogs);

	const [localImage] = await multibuild.performBuilds([task], docker);

	if (!localImage.successful) {
		throw new LocalPushErrors.BuildError([
			{
				error: localImage.error!,
				serviceName,
			},
		]);
	}

	return buildLogs[task.serviceName];
}

function assignOutputHandlers(
	buildTasks: BuildTask[],
	logger: Logger,
	buildLogs?: Dictionary<string>,
) {
	_.each(buildTasks, task => {
		if (task.external) {
			task.progressHook = progressObj => {
				displayBuildLog(
					{ serviceName: task.serviceName, message: progressObj.progress },
					logger,
				);
			};
		} else {
			if (buildLogs) {
				buildLogs[task.serviceName] = '';
			}
			task.streamHook = stream => {
				stream.on('data', (buf: Buffer) => {
					const str = _.trimEnd(buf.toString());
					if (str !== '') {
						displayBuildLog(
							{ serviceName: task.serviceName, message: str },
							logger,
						);

						if (buildLogs) {
							buildLogs[task.serviceName] = `${
								buildLogs[task.serviceName]
							}\n${str}`;
						}
					}
				});
			};
		}
	});
}

async function getDeviceDockerImages(docker: Docker): Promise<string[]> {
	const images = await docker.listImages();

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

	await Bluebird.map(buildTasks, async (task: BuildTask) => {
		task.dockerOpts = {
			cachefrom: images,
			labels: {
				'io.resin.local.image': '1',
				'io.resin.local.service': task.serviceName,
			},
			t: generateImageName(task.serviceName),
			nocache: opts.nocache,
			forcerm: true,
		};
		if (task.external) {
			task.dockerOpts.authconfig = await getAuthConfigObj(
				task.imageName!,
				opts.registrySecrets,
			);
		} else {
			task.dockerOpts.registryconfig = opts.registrySecrets;
		}
	});
}

function generateImageName(serviceName: string): string {
	return `local_image_${serviceName}:latest`;
}

export function generateTargetState(
	currentTargetState: any,
	composition: Composition,
): any {
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

		services[idx] = _.merge(defaults, opts, {
			imageId: idx,
			serviceName: name,
			serviceId: idx,
			image: generateImageName(name),
			running: true,
		});
		idx += 1;
	});

	const targetState = _.cloneDeep(currentTargetState);
	delete targetState.local.apps;

	targetState.local.apps = {
		1: {
			name: 'localapp',
			commit: 'localrelease',
			releaseId: '1',
			services,
			volumes: composition.volumes || {},
			networks: composition.networks || {},
		},
	};

	return targetState;
}

async function inspectBuildResults(images: LocalImage[]): Promise<void> {
	const { exitWithExpectedError } = await import('../patterns');

	const failures: LocalPushErrors.BuildFailure[] = [];

	_.each(images, image => {
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
