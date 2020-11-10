import * as chokidar from 'chokidar';
import type * as Dockerode from 'dockerode';
import Livepush, { ContainerNotRunningError } from 'livepush';
import * as _ from 'lodash';
import * as path from 'path';
import type { Composition } from 'resin-compose-parse';
import type { BuildTask } from 'resin-multibuild';

import { instanceOf } from '../../errors';
import Logger = require('../logger');

import { Dockerfile } from 'livepush';
import type DeviceAPI from './api';
import type { DeviceInfo, Status } from './api';
import {
	DeviceDeployOptions,
	generateTargetState,
	rebuildSingleTask,
} from './deploy';
import { BuildError } from './errors';
import { getServiceColourFn } from './logs';
import { delay } from '../helpers';
import { getServiceDirsFromComposition } from '../compose_ts';
import { getDockerignoreByDir } from '../ignore';

// How often do we want to check the device state
// engine has settled (delay in ms)
const DEVICE_STATUS_SETTLE_CHECK_INTERVAL = 1000;

const LIVEPUSH_DEBOUNCE_TIMEOUT = 2000;

interface MonitoredContainer {
	context: string;
	livepush: Livepush;
	monitor: chokidar.FSWatcher;
	containerId: string;
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

	// A map of service names to events waiting
	private updateEventsWaiting: Dictionary<string[]> = {};
	private deleteEventsWaiting: Dictionary<string[]> = {};

	private rebuildsRunning: Dictionary<boolean> = {};
	private rebuildRunningIds: Dictionary<string> = {};
	private rebuildsCancelled: Dictionary<boolean> = {};

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
				if (buildTask.dockerfile == null) {
					throw new Error(
						`Could not detect dockerfile for service: ${serviceName}`,
					);
				}
				const dockerfile = new Dockerfile(buildTask.dockerfile);

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
					return;
				}

				const livepush = await Livepush.init({
					dockerfile,
					context,
					containerId: container.containerId,
					stageImages: this.imageIds[serviceName],
					docker: this.docker,
				});
				const buildVars = buildTask.buildMetadata.getBuildVarsForService(
					buildTask.serviceName,
				);
				if (!_.isEmpty(buildVars)) {
					livepush.setBuildArgs(buildVars);
				}

				this.assignLivepushOutputHandlers(serviceName, livepush);

				this.updateEventsWaiting[serviceName] = [];
				this.deleteEventsWaiting[serviceName] = [];
				const addEvent = (eventQueue: string[], changedPath: string) => {
					this.logger.logDebug(
						`Got an add filesystem event for service: ${serviceName}. File: ${changedPath}`,
					);
					eventQueue.push(changedPath);
					this.getDebouncedEventHandler(serviceName)();
				};

				// Prepare dockerignore data for file watcher
				const serviceDirsByService = this.deployOpts.multiDockerignore
					? await getServiceDirsFromComposition(
							this.deployOpts.source,
							this.composition,
					  )
					: {};
				const { ignoreByDir, serviceDirs } = await getDockerignoreByDir(
					this.deployOpts.source,
					serviceDirsByService,
				);

				// TODO: Memoize this for containers which share a context
				const monitor = chokidar.watch('.', {
					cwd: context,
					ignoreInitial: true,
					ignored: (filePath: string) => {
						for (const dir of serviceDirs) {
							if (filePath.startsWith(dir)) {
								return ignoreByDir[dir].ignores(filePath.substring(dir.length));
							}
						}
						return ignoreByDir['.'].ignores(filePath);
					},
				});
				monitor.on('add', (changedPath: string) =>
					addEvent(this.updateEventsWaiting[serviceName], changedPath),
				);
				monitor.on('change', (changedPath: string) =>
					addEvent(this.updateEventsWaiting[serviceName], changedPath),
				);
				monitor.on('unlink', (changedPath: string) =>
					addEvent(this.deleteEventsWaiting[serviceName], changedPath),
				);

				this.containers[serviceName] = {
					livepush,
					context,
					monitor,
					containerId: container.containerId,
				};

				this.rebuildsRunning[serviceName] = false;
				this.rebuildsCancelled[serviceName] = false;
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
				_.map(this.containers, (container) => {
					container.livepush.cleanupIntermediateContainers();
				}),
			);

			process.exit(0);
		});
	}

	public static preprocessDockerfile(content: string): string {
		return new Dockerfile(content).generateLiveDockerfile();
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
		// Cache the state to avoid unnecessary calls
		this.lastDeviceStatus = await this.api.getStatus();

		if (this.lastDeviceStatus.appState === 'applied') {
			return;
		}

		this.logger.logDebug(
			`Device state not settled, retrying in ${DEVICE_STATUS_SETTLE_CHECK_INTERVAL}ms`,
		);
		await delay(DEVICE_STATUS_SETTLE_CHECK_INTERVAL);
		await this.awaitDeviceStateSettle();
	}

	private async handleFSEvents(serviceName: string): Promise<void> {
		const updated = this.updateEventsWaiting[serviceName];
		const deleted = this.deleteEventsWaiting[serviceName];
		this.updateEventsWaiting[serviceName] = [];
		this.deleteEventsWaiting[serviceName] = [];

		// First we detect if the file changed is the Dockerfile
		// used to build the service
		if (
			_.some(this.dockerfilePaths[serviceName], (name) =>
				_.some(updated, (changed) => name === changed),
			)
		) {
			this.logger.logLivepush(
				`Detected Dockerfile change, performing full rebuild of service ${serviceName}`,
			);
			await this.handleServiceRebuild(serviceName);
			return;
		}

		// Work out if we need to perform any changes on this container
		const livepush = this.containers[serviceName].livepush;

		if (!livepush.livepushNeeded(updated, deleted)) {
			return;
		}

		this.logger.logLivepush(
			`Detected changes for container ${serviceName}, updating...`,
		);

		try {
			await livepush.performLivepush(updated, deleted);
		} catch (e) {
			this.logger.logError(
				`An error occured whilst trying to perform a livepush: `,
			);
			if (instanceOf(e, ContainerNotRunningError)) {
				this.logger.logError('   Livepush container not running');
			} else {
				this.logger.logError(`   ${e.message}`);
			}
			this.logger.logDebug(e.stack);
		}
	}

	private async handleServiceRebuild(serviceName: string): Promise<void> {
		if (this.rebuildsRunning[serviceName]) {
			this.logger.logLivepush(
				`Cancelling ongoing rebuild for service ${serviceName}`,
			);
			await this.cancelRebuild(serviceName);
			while (this.rebuildsCancelled[serviceName]) {
				await delay(1000);
			}
		}

		this.rebuildsRunning[serviceName] = true;
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
					(id) => {
						this.rebuildRunningIds[serviceName] = id;
					},
				);
			} catch (e) {
				if (!(e instanceof BuildError)) {
					throw e;
				}

				if (this.rebuildsCancelled[serviceName]) {
					return;
				}

				this.logger.logError(
					`Rebuild of service ${serviceName} failed!\n  Error: ${e.getServiceError(
						serviceName,
					)}`,
				);
				return;
			} finally {
				delete this.rebuildRunningIds[serviceName];
			}

			// If the build has been cancelled, exit early
			if (this.rebuildsCancelled[serviceName]) {
				return;
			}

			// Let's first delete the container from the device
			const containerId = await this.api.getContainerId(serviceName);
			await this.docker.getContainer(containerId).remove({ force: true });
			const currentState = await this.api.getTargetState();
			// If we re-apply the target state, the supervisor
			// should recreate the container
			await this.api.setTargetState(
				generateTargetState(currentState, this.composition, [buildTask], {}),
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

			const dockerfile = new Dockerfile(buildTask.dockerfile!);

			instance.livepush = await Livepush.init({
				dockerfile,
				context: buildTask.context!,
				containerId: container.containerId,
				stageImages: stageImages[serviceName],
				docker: this.docker,
			});
			this.assignLivepushOutputHandlers(serviceName, instance.livepush);
		} catch (e) {
			this.logger.logError(`There was an error rebuilding the service: ${e}`);
		} finally {
			this.rebuildsRunning[serviceName] = false;
			this.rebuildsCancelled[serviceName] = false;
		}
	}

	private async cancelRebuild(serviceName: string) {
		this.rebuildsCancelled[serviceName] = true;

		// If we have a container id of the current build,
		// attempt to kill it
		if (this.rebuildRunningIds[serviceName] != null) {
			try {
				await this.docker
					.getContainer(this.rebuildRunningIds[serviceName])
					.remove({ force: true });
				await this.containers[serviceName].livepush.cancel();
			} catch {
				// No need to do anything here
			}
		}
	}

	private assignLivepushOutputHandlers(
		serviceName: string,
		livepush: Livepush,
	) {
		const msgString = (msg: string) =>
			`[${getServiceColourFn(serviceName)(serviceName)}] ${msg}`;
		const log = (msg: string) => this.logger.logLivepush(msgString(msg));
		const error = (msg: string) => this.logger.logError(msgString(msg));
		const debugLog = (msg: string) => this.logger.logDebug(msgString(msg));

		livepush.on('commandExecute', (command) =>
			log(`Executing command: \`${command.command}\``),
		);
		livepush.on('commandOutput', (output) =>
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
		livepush.on('cancel', () => {
			log('Cancelling current livepush...');
		});
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

	// For each service, get a debounced function
	private getDebouncedEventHandler = _.memoize((serviceName: string) => {
		return _.debounce(
			() => this.handleFSEvents(serviceName),
			LIVEPUSH_DEBOUNCE_TIMEOUT,
		);
	});
}

export default LivepushManager;
