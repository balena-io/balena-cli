import * as Bluebird from 'bluebird';
import * as Docker from 'dockerode';
import * as _ from 'lodash';
import { Composition } from 'resin-compose-parse';
import { BuildTask, LocalImage } from 'resin-multibuild';
import { Readable } from 'stream';

import Logger = require('../logger');
import { displayBuildLog } from './logs';

import { DeviceInfo } from './api';
import * as LocalPushErrors from './errors';

// Define the logger here so the debug output
// can be used everywhere
const logger = new Logger();

export interface DeviceDeployOptions {
	source: string;
	deviceHost: string;
	devicePort?: number;
}

async function checkSource(source: string): Promise<boolean> {
	const { fs } = await import('mz');
	return (await fs.exists(source)) && (await fs.stat(source)).isDirectory();
}

export async function deployToDevice(opts: DeviceDeployOptions): Promise<void> {
	const { loadProject, tarDirectory } = await import('../compose');
	const { exitWithExpectedError } = await import('../patterns');

	const { DeviceAPI } = await import('./api');
	const { displayDeviceLogs } = await import('./logs');

	if (!(await checkSource(opts.source))) {
		exitWithExpectedError(`Could not access source directory: ${opts.source}`);
	}

	const api = new DeviceAPI(logger, opts.deviceHost);

	// TODO: Before merge, replace this with the supervisor version endpoint, to
	// ensure we're working with a supervisor version that supports the stuff we need
	await api.ping();

	logger.logInfo(`Starting build on device ${opts.deviceHost}`);

	const project = await loadProject(logger, opts.source, 'local');

	// Attempt to attach to the device's docker daemon
	const docker = connectToDocker(
		opts.deviceHost,
		opts.devicePort != null ? opts.devicePort : 2375,
	);

	const tarStream = await tarDirectory(opts.source);

	// Try to detect the device information
	const deviceInfo = await api.getDeviceInformation();

	await performBuilds(
		project.composition,
		tarStream,
		docker,
		deviceInfo,
		logger,
	);

	logger.logDebug('Setting device state...');
	// Now set the target state on the device

	const currentTargetState = await api.getTargetState();

	const targetState = generateTargetState(
		currentTargetState,
		project.composition,
	);
	logger.logDebug(`Sending target state: ${JSON.stringify(targetState)}`);

	await api.setTargetState(targetState);

	// Print an empty newline to seperate the build output
	// from the device output
	console.log();
	logger.logInfo('Streaming device logs...');
	// Now all we need to do is stream back the logs
	const logStream = await api.getLogStream();

	await displayDeviceLogs(logStream, logger);
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
): Promise<void> {
	const multibuild = await import('resin-multibuild');

	const buildTasks = await multibuild.splitBuildStream(composition, tarStream);

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
	await multibuild.performResolution(
		buildTasks,
		deviceInfo.arch,
		deviceInfo.deviceType,
	);

	logger.logDebug('Found project types:');
	_.each(buildTasks, task => {
		if (!task.external) {
			logger.logDebug(`    ${task.serviceName}: ${task.projectType}`);
		} else {
			logger.logDebug(`    ${task.serviceName}: External image`);
		}
	});

	logger.logDebug('Probing remote daemon for cache images');
	await assignDockerBuildOpts(docker, buildTasks);

	logger.logDebug('Starting builds...');
	await assignOutputHandlers(buildTasks, logger);
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
}

function assignOutputHandlers(buildTasks: BuildTask[], logger: Logger) {
	_.each(buildTasks, task => {
		if (task.external) {
			task.progressHook = progressObj => {
				displayBuildLog(
					{ serviceName: task.serviceName, message: progressObj.progress },
					logger,
				);
			};
		} else {
			task.streamHook = stream => {
				stream.on('data', (buf: Buffer) => {
					const str = buf.toString().trimRight();
					if (str !== '') {
						displayBuildLog(
							{ serviceName: task.serviceName, message: str },
							logger,
						);
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
): Promise<void> {
	// Get all of the images on the remote docker daemon, so
	// that we can use all of them for cache
	const images = await getDeviceDockerImages(docker);

	logger.logDebug(`Using ${images.length} on-device images for cache...`);

	_.each(buildTasks, (task: BuildTask) => {
		task.dockerOpts = {
			cachefrom: images,
			labels: {
				'io.resin.local.image': '1',
				'io.resin.local.service': task.serviceName,
			},
			t: generateImageName(task.serviceName),
		};
	});
}

function generateImageName(serviceName: string): string {
	return `local_image_${serviceName}:latest`;
}

function generateTargetState(
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
			commit: 'localcommit',
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
		exitWithExpectedError(new LocalPushErrors.BuildError(failures));
	}
}
