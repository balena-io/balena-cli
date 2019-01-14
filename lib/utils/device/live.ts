import * as Bluebird from 'bluebird';
import * as chokidar from 'chokidar';
import * as Dockerode from 'dockerode';
import Livepush from 'livepush';
import * as _ from 'lodash';
import * as path from 'path';
import { Composition } from 'resin-compose-parse';
import { BuildTask } from 'resin-multibuild';

import Logger = require('../logger');

import DeviceAPI, { Status } from './api';

// How often do we want to check the device state
// engine has settled (delay in ms)
const DEVICE_STATUS_SETTLE_CHECK_INTERVAL = 500;

interface MonitoredContainer {
	context: string;
	livepush: Livepush;
	monitor: chokidar.FSWatcher;
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
}

export class LivepushManager {
	private lastDeviceStatus: Status | null = null;
	private containers: Dictionary<MonitoredContainer> = {};

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
		this.imageIds = LivepushManager.getMultistageImageIDs(opts.buildLogs);
	}

	public async init(): Promise<void> {
		this.logger.logLivepush('Waiting for device state to settle...');
		// The first thing we need to do is let the state 'settle',
		// so that all of the containers are running and ready to
		// be livepush'd into
		await this.awaitDeviceStateSettle();
		// Split the composition into a load of differents paths which we can
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

				// Find the containerId from the device state
				const container = _.find(this.lastDeviceStatus!.containers, {
					serviceName,
				});
				if (container == null) {
					throw new Error(
						`Could not find a container on device for service: ${serviceName}`,
					);
				}

				const log = (msg: string) => {
					this.logger.logLivepush(`[service ${serviceName}] ${msg}`);
				};

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
				};
			}
		}
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
		// TODO: If there's a dockerfile event, we must perform a rebuild
		this.logger.logDebug(
			`Got a filesystem event for service: ${
				fsEvent.serviceName
			}. Event: ${JSON.stringify(fsEvent)}`,
		);

		let updates: string[] = [];
		let deletes: string[] = [];
		switch (fsEvent.type) {
			case 'add':
				updates = [fsEvent.filename];
				break;
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
		await livepush.performLivepush(updates, deletes);
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
}

export default LivepushManager;
