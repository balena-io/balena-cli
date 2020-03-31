import * as Promise from 'bluebird';
import * as _ from 'lodash';
import * as dockerUtils from '../../utils/docker';
import { exitWithExpectedError } from '../../utils/patterns';
import { getChalk } from '../../utils/lazy';

export const dockerPort = 2375;
export const dockerTimeout = 2000;

export const filterOutSupervisorContainer = function(container) {
	for (const name of container.Names) {
		if (
			name.includes('resin_supervisor') ||
			name.includes('balena_supervisor')
		) {
			return false;
		}
	}
	return true;
};

export const selectContainerFromDevice = Promise.method(function(
	deviceIp,
	filterSupervisor,
) {
	if (filterSupervisor == null) {
		filterSupervisor = false;
	}
	const form = require('resin-cli-form');
	const docker = dockerUtils.createClient({
		host: deviceIp,
		port: dockerPort,
		timeout: dockerTimeout,
	});

	// List all containers, including those not running
	return docker.listContainers({ all: true }).then(function(containers) {
		containers = containers.filter(function(container) {
			if (!filterSupervisor) {
				return true;
			}
			return filterOutSupervisorContainer(container);
		});
		if (_.isEmpty(containers)) {
			exitWithExpectedError(`No containers found in ${deviceIp}`);
		}

		return form.ask({
			message: 'Select a container',
			type: 'list',
			choices: _.map(containers, function(container) {
				const containerName = container.Names?.[0] || 'Untitled';
				const shortContainerId = ('' + container.Id).substr(0, 11);

				return {
					name: `${containerName} (${shortContainerId})`,
					value: container.Id,
				};
			}),
		});
	});
});

export const pipeContainerStream = Promise.method(function({
	deviceIp,
	name,
	outStream,
	follow,
}) {
	if (follow == null) {
		follow = false;
	}
	const docker = dockerUtils.createClient({ host: deviceIp, port: dockerPort });

	const container = docker.getContainer(name);
	return container
		.inspect()
		.then(containerInfo => containerInfo?.State?.Running)
		.then(isRunning =>
			container.attach({
				logs: !follow || !isRunning,
				stream: follow && isRunning,
				stdout: true,
				stderr: true,
			}),
		)
		.then(containerStream => containerStream.pipe(outStream))
		.catch(function(err) {
			err = '' + err.statusCode;
			if (err === '404') {
				return console.log(
					getChalk().red.bold(`Container '${name}' not found.`),
				);
			}
			throw err;
		});
});
