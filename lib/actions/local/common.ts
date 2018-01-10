import Promise = require('bluebird');
import _ = require('lodash');
import * as Dockerode from 'dockerode';
import Docker = require('docker-toolbelt');
import form = require('resin-cli-form');
import chalk from 'chalk';

export { getSubShellCommand } from '../../utils/helpers';

export const dockerPort = 2375;
export const dockerTimeout = 2000;

export function isNotSupervisorContainer(container: Dockerode.ContainerInfo) {
	return _.every(
		container.Names,
		name => !_.includes(name, 'resin_supervisor'),
	);
}

export const selectContainerFromDevice = Promise.method(
	(deviceIp: string, filterSupervisor?: boolean) => {
		if (filterSupervisor == null) {
			filterSupervisor = false;
		}
		const docker = new Docker({
			host: deviceIp,
			port: dockerPort,
			timeout: dockerTimeout,
		});

		// List all containers, including those not running
		return docker.listContainers({ all: true }).then(containers => {
			containers = containers.filter(
				container => !filterSupervisor || isNotSupervisorContainer(container),
			);

			if (_.isEmpty(containers)) {
				throw new Error(`No containers found in ${deviceIp}`);
			}

			return form.ask({
				message: 'Select a container',
				type: 'list',
				choices: containers.map(container => {
					const containerName = container.Names[0] || 'Untitled';
					const shortContainerId = `${container.Id}`.substr(0, 11);
					const containerStatus = container.Status;

					return {
						name: `${containerName} (${shortContainerId}) - ${containerStatus}`,
						value: container.Id,
					};
				}),
			});
		});
	},
);

export const pipeContainerStream = Promise.method(
	({
		deviceIp,
		name,
		outStream,
		follow = false,
	}: {
		deviceIp: string;
		name: string;
		outStream: NodeJS.WritableStream;
		follow?: boolean;
	}) => {
		const docker = new Docker({ host: deviceIp, port: dockerPort });

		const container = docker.getContainer(name);
		return container
			.inspect()
			.then(
				containerInfo =>
					containerInfo && containerInfo.State
						? containerInfo.State.Running
						: undefined,
			)
			.then(isRunning =>
				container.attach({
					logs: !follow || !isRunning,
					stream: follow && isRunning,
					stdout: true,
					stderr: true,
				}),
			)
			.then(containerStream => containerStream.pipe(outStream))
			.catch((err: any) => {
				err = `${err.statusCode}`;
				if (err === '404') {
					return console.log(chalk.red.bold(`Container '${name}' not found.`));
				}
				throw err;
			});
	},
);
