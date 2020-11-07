/**
 * @license
 * Copyright 2019-2020 Balena Ltd.
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

import * as chokidar from 'chokidar';
import type * as Dockerode from 'dockerode';
import * as fs from 'fs';
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

		// Prepare dockerignore data for file watcher
		const { getDockerignoreByService } = await import('../ignore');
		const { getServiceDirsFromComposition } = await import('../compose_ts');
		const rootContext = path.resolve(this.buildContext);
		const serviceDirsByService = await getServiceDirsFromComposition(
			this.deployOpts.source,
			this.composition,
		);
		const dockerignoreByService = await getDockerignoreByService(
			this.deployOpts.source,
			this.deployOpts.multiDockerignore,
			serviceDirsByService,
		);

		// create livepush instances for each service
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

				// path.resolve() converts to an absolute path, removes trailing slashes,
				// and also converts forward slashes to backslashes on Windows.
				const context = path.resolve(rootContext, service.build.context);

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
				const addEvent = ($serviceName: string, changedPath: string) => {
					this.logger.logDebug(
						`Got an add filesystem event for service: ${$serviceName}. File: ${changedPath}`,
					);
					const eventQueue = this.updateEventsWaiting[$serviceName];
					eventQueue.push(changedPath);
					this.getDebouncedEventHandler($serviceName)();
				};

				const monitor = this.setupFilesystemWatcher(
					serviceName,
					rootContext,
					context,
					addEvent,
					dockerignoreByService,
					this.deployOpts.multiDockerignore,
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
		process.once('SIGINT', async () => {
			this.logger.logLivepush('Cleaning up device...');
			await Promise.all(
				_.map(this.containers, (container) => {
					container.livepush.cleanupIntermediateContainers();
				}),
			);
			this.logger.logDebug('Cleaning up done.');
		});
	}

	protected setupFilesystemWatcher(
		serviceName: string,
		rootContext: string,
		serviceContext: string,
		changedPathHandler: (serviceName: string, changedPath: string) => void,
		dockerignoreByService: {
			[serviceName: string]: import('@balena/dockerignore').Ignore;
		},
		multiDockerignore: boolean,
	): chokidar.FSWatcher {
		const contextForDockerignore = multiDockerignore
			? serviceContext
			: rootContext;
		const dockerignore = dockerignoreByService[serviceName];
		// TODO: Memoize this for services that share a context
		const monitor = chokidar.watch('.', {
			cwd: serviceContext,
			followSymlinks: true,
			ignoreInitial: true,
			ignored: (filePath: string, stats: fs.Stats | undefined) => {
				if (!stats) {
					try {
						// sync because chokidar defines a sync interface
						stats = fs.lstatSync(filePath);
					} catch (err) {
						// OK: the file may have been deleted. See also:
						// https://github.com/paulmillr/chokidar/blob/3.4.3/lib/fsevents-handler.js#L326-L328
						// https://github.com/paulmillr/chokidar/blob/3.4.3/lib/nodefs-handler.js#L364
					}
				}
				if (stats && !stats.isFile() && !stats.isSymbolicLink()) {
					// never ignore directories for compatibility with
					// dockerignore exclusion patterns
					return !stats.isDirectory();
				}
				const relPath = path.relative(contextForDockerignore, filePath);
				return dockerignore.ignores(relPath);
			},
		});
		monitor.on('add', (changedPath: string) =>
			changedPathHandler(serviceName, changedPath),
		);
		monitor.on('change', (changedPath: string) =>
			changedPathHandler(serviceName, changedPath),
		);
		monitor.on('unlink', (changedPath: string) =>
			changedPathHandler(serviceName, changedPath),
		);
		return monitor;
	}

	/** Stop the filesystem watcher, allowing the Node process to exit gracefully */
	public close() {
		for (const container of Object.values(this.containers)) {
			container.monitor.close().catch((err) => {
				if (process.env.DEBUG) {
					this.logger.logDebug(`chokidar.close() ${err.message}`);
				}
			});
		}
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
