import * as Bluebird from 'bluebird';
import * as chokidar from 'chokidar';
import * as Dockerode from 'dockerode';
import Livepush from 'livepush';
import * as _ from 'lodash';
import * as path from 'path';
import { Composition } from 'resin-compose-parse';
import { BuildTask } from 'resin-multibuild';

import Logger = require('../logger');

import DeviceAPI, { DeviceInfo, Status } from './api';
import {
	DeviceDeployOptions,
	generateTargetState,
	rebuildSingleTask,
} from './deploy';
import { BuildError } from './errors';
import { getServiceColourFn } from './logs';

// How often do we want to check the device state
// engine has settled (delay in ms)
const DEVICE_STATUS_SETTLE_CHECK_INTERVAL = 1000;

interface MonitoredContainer {
	context: string;
	livepush: Livepush;
	monitor: chokidar.FSWatcher;
	containerId: string;
}

interface ContextEvent {
	type: 'add' | 'change' | 'unlink';
	filename: string;
	serviceName: string;
}

type BuildLogs = Dictionary<string>;
type StageImageIDs = Dictionary<string[]>;

export interface LivepushOpts {
	buildContext: string;
	composition: Composition;
	buildTasks: BuildTask[];
	docker: Dockerode;
	api: DeviceAPI;
	logger: Logger;
	buildLogs: BuildLogs;
	deployOpts: DeviceDeployOptions;
}

export class LivepushManager {
	private lastDeviceStatus: Status | null = null;
	private containers: Dictionary<MonitoredContainer> = {};
	private dockerfilePaths: Dictionary<string[]> = {};
	private deviceInfo: DeviceInfo;
	private deployOpts: DeviceDeployOptions;

	private buildContext: string;
	private composition: Composition;
	private buildTasks: BuildTask[];
	private docker: Dockerode;
	private api: DeviceAPI;
	private logger: Logger;
	private imageIds: StageImageIDs;

	public constructor(opts: LivepushOpts) {
		this.buildContext = opts.buildContext;
		this.composition = opts.composition;
		this.buildTasks = opts.buildTasks;
		this.docker = opts.docker;
		this.api = opts.api;
		this.logger = opts.logger;
		this.deployOpts = opts.deployOpts;
		this.imageIds = LivepushManager.getMultistageImageIDs(opts.buildLogs);
	}

	public async init(): Promise<void> {
		this.deviceInfo = await this.api.getDeviceInformation();
		this.logger.logLivepush('Waiting for device state to settle...');
		// The first thing we need to do is let the state 'settle',
		// so that all of the containers are running and ready to
		// be livepush'd into
		await this.awaitDeviceStateSettle();
		// Split the composition into a load of differents paths
		// which we can
		this.logger.logLivepush('Device state settled');
		// create livepush instances for

		for (const serviceName of _.keys(this.composition.services)) {
			const service = this.composition.services[serviceName];
			const buildTask = _.find(this.buildTasks, { serviceName });

			if (buildTask == null) {
				throw new Error(
					`Could not find a build task for service: ${serviceName}`,
				);
			}

			// We only care about builds
			if (service.build != null) {
				const context = path.join(this.buildContext, service.build.context);
				const dockerfile = buildTask.dockerfile;
				if (dockerfile == null) {
					throw new Error(
						`Could not detect dockerfile for service: ${serviceName}`,
					);
				}

				if (buildTask.dockerfilePath == null) {
					// this is a bit of a hack as resin-bundle-resolve
					// does not always export the dockerfilePath, this
					// only happens when the dockerfile path is
					// specified differently - this should be patched
					// in resin-bundle-resolve
					this.dockerfilePaths[
						buildTask.serviceName
					] = this.getDockerfilePathFromTask(buildTask);
				} else {
					this.dockerfilePaths[buildTask.serviceName] = [
						buildTask.dockerfilePath,
					];
				}

				// Find the containerId from the device state
				const container = _.find(this.lastDeviceStatus!.containers, {
					serviceName,
				});
				if (container == null) {
					throw new Error(
						`Could not find a container on device for service: ${serviceName}`,
					);
				}

				const msgString = (msg: string) =>
					`[${getServiceColourFn(serviceName)(serviceName)}] ${msg}`;
				const log = (msg: string) => this.logger.logLivepush(msgString(msg));
				const error = (msg: string) => this.logger.logError(msgString(msg));
				const debugLog = (msg: string) => this.logger.logDebug(msgString(msg));

				const livepush = await Livepush.init(
					dockerfile,
					context,
					container.containerId,
					this.imageIds[serviceName],
					this.docker,
				);

				livepush.on('commandExecute', command =>
					log(`Executing command: \`${command.command}\``),
				);
				livepush.on('commandOutput', output =>
					log(`   ${output.output.data.toString()}`),
				);
				livepush.on('commandReturn', ({ returnCode, command }) => {
					if (returnCode !== 0) {
						error(`  Command ${command} failed with exit code: ${returnCode}`);
					} else {
						debugLog(`Command ${command} exited successfully`);
					}
				});
				livepush.on('containerRestart', () => {
					log('Restarting service...');
				});

				// TODO: Memoize this for containers which share a context
				const monitor = chokidar.watch('.', {
					cwd: context,
					ignoreInitial: true,
				});
				monitor.on('add', (changedPath: string) =>
					this.handleFSEvent({
						filename: changedPath,
						type: 'add',
						serviceName,
					}),
				);
				monitor.on('change', (changedPath: string) =>
					this.handleFSEvent({
						filename: changedPath,
						type: 'change',
						serviceName,
					}),
				);
				monitor.on('unlink', (changedPath: string) =>
					this.handleFSEvent({
						filename: changedPath,
						type: 'unlink',
						serviceName,
					}),
				);
				this.containers[serviceName] = {
					livepush,
					context,
					monitor,
					containerId: container.containerId,
				};
			}
		}

		// Setup cleanup handlers for the device

		// This is necessary because the `exit-hook` module is used by several
		// dependencies, and will exit without calling the following handler.
		// Once https://github.com/balena-io/balena-cli/issues/867 has been solved,
		// we are free to (and definitely should) remove the below line
		process.removeAllListeners('SIGINT');
		process.on('SIGINT', async () => {
			this.logger.logLivepush('Cleaning up device...');
			await Promise.all(
				_.map(this.containers, container => {
					container.livepush.cleanupIntermediateContainers();
				}),
			);

			process.exit(0);
		});
	}

	private static getMultistageImageIDs(buildLogs: BuildLogs): StageImageIDs {
		const stageIds: StageImageIDs = {};
		_.each(buildLogs, (log, serviceName) => {
			stageIds[serviceName] = [];

			const lines = log.split(/\r?\n/);
			let lastArrowMessage: string | undefined;
			for (const line of lines) {
				// If this was a from line, take the last found
				// image id and save it
				if (
					/step \d+(?:\/\d+)?\s*:\s*FROM/i.test(line) &&
					lastArrowMessage != null
				) {
					stageIds[serviceName].push(lastArrowMessage);
				} else {
					const msg = LivepushManager.extractDockerArrowMessage(line);
					if (msg != null) {
						lastArrowMessage = msg;
					}
				}
			}
		});

		return stageIds;
	}

	private async awaitDeviceStateSettle(): Promise<void> {
		// Cache the state to avoid unnecessary cals
		this.lastDeviceStatus = await this.api.getStatus();

		if (this.lastDeviceStatus.appState === 'applied') {
			return;
		}

		this.logger.logDebug(
			`Device state not settled, retrying in ${DEVICE_STATUS_SETTLE_CHECK_INTERVAL}ms`,
		);
		await Bluebird.delay(DEVICE_STATUS_SETTLE_CHECK_INTERVAL);
		await this.awaitDeviceStateSettle();
	}

	private async handleFSEvent(fsEvent: ContextEvent): Promise<void> {
		this.logger.logDebug(
			`Got a filesystem event for service: ${
				fsEvent.serviceName
			}. Event: ${JSON.stringify(fsEvent)}`,
		);

		// First we detect if the file changed is the Dockerfile
		// used to build the service
		if (
			_.some(
				this.dockerfilePaths[fsEvent.serviceName],
				name => name === fsEvent.filename,
			)
		) {
			if (fsEvent.type !== 'change') {
				throw new Error(`Deletion or addition of Dockerfiles not supported`);
			}

			this.logger.logLivepush(
				`Detected Dockerfile change, performing full rebuild of service ${
					fsEvent.serviceName
				}`,
			);
			await this.handleServiceRebuild(fsEvent.serviceName);
			return;
		}

		let updates: string[] = [];
		let deletes: string[] = [];
		switch (fsEvent.type) {
			case 'add':
			case 'change':
				updates = [fsEvent.filename];
				break;
			case 'unlink':
				deletes = [fsEvent.filename];
				break;
			default:
				throw new Error(`Unknown event: ${fsEvent.type}`);
		}

		// Work out if we need to perform any changes on this container
		const livepush = this.containers[fsEvent.serviceName].livepush;

		this.logger.logLivepush(
			`Detected changes for container ${fsEvent.serviceName}, updating...`,
		);

		try {
			await livepush.performLivepush(updates, deletes);
		} catch (e) {
			this.logger.logError(
				`An error occured whilst trying to perform a livepush: `,
			);
			this.logger.logError(`   ${e.message}`);
			this.logger.logDebug(e.stack);
		}
	}

	private async handleServiceRebuild(serviceName: string): Promise<void> {
		try {
			const buildTask = _.find(this.buildTasks, { serviceName });
			if (buildTask == null) {
				throw new Error(
					`Could not find a build task for service ${serviceName}`,
				);
			}

			let buildLog: string;
			try {
				buildLog = await rebuildSingleTask(
					serviceName,
					this.docker,
					this.logger,
					this.deviceInfo,
					this.composition,
					this.buildContext,
					this.deployOpts,
				);
			} catch (e) {
				if (!(e instanceof BuildError)) {
					throw e;
				}

				this.logger.logError(
					`Rebuild of service ${serviceName} failed!\n  Error: ${e.getServiceError(
						serviceName,
					)}`,
				);
				return;
			}

			// TODO: The code below is quite roundabout, and instead
			// we'd prefer just to call a supervisor endpoint which
			// recreates a container, but that doesn't exist yet

			// First we request the current target state
			const currentState = await this.api.getTargetState();

			// Then we generate a target state without the service
			// we rebuilt
			const comp = _.cloneDeep(this.composition);
			delete comp.services[serviceName];
			const intermediateState = generateTargetState(currentState, comp);
			await this.api.setTargetState(intermediateState);

			// Now we wait for the device state to settle
			await this.awaitDeviceStateSettle();

			// And re-set the target state
			await this.api.setTargetState(
				generateTargetState(currentState, this.composition),
			);

			await this.awaitDeviceStateSettle();

			const instance = this.containers[serviceName];
			// Get the new container
			const container = _.find(this.lastDeviceStatus!.containers, {
				serviceName,
			});
			if (container == null) {
				throw new Error(
					`Could not find new container for service ${serviceName}`,
				);
			}

			const buildLogs: Dictionary<string> = {};
			buildLogs[serviceName] = buildLog;
			const stageImages = LivepushManager.getMultistageImageIDs(buildLogs);

			instance.livepush = await Livepush.init(
				buildTask.dockerfile!,
				buildTask.context!,
				container.containerId,
				stageImages[serviceName],
				this.docker,
			);
		} catch (e) {
			this.logger.logError(`There was an error rebuilding the service: ${e}`);
		}
	}

	private static extractDockerArrowMessage(
		outputLine: string,
	): string | undefined {
		const arrowTest = /^.*\s*-+>\s*(.+)/i;
		const match = arrowTest.exec(outputLine);
		if (match != null) {
			return match[1];
		}
	}

	private getDockerfilePathFromTask(task: BuildTask): string[] {
		switch (task.projectType) {
			case 'Standard Dockerfile':
				return ['Dockerfile'];
			case 'Dockerfile.template':
				return ['Dockerfile.template'];
			case 'Architecture-specific Dockerfile':
				return [
					`Dockerfile.${this.deviceInfo.arch}`,
					`Dockerfile.${this.deviceInfo.deviceType}`,
				];
			default:
				return [];
		}
	}
}

export default LivepushManager;
