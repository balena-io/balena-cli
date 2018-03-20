/*
Copyright 2016-2017 Resin.io

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import os = require('os');
import Promise = require('bluebird');
import _ = require('lodash');
import chalk from 'chalk';
import rindle = require('rindle');
import imagefs = require('resin-image-fs');
import visuals = require('resin-cli-visuals');
import ResinSdk = require('resin-sdk');

import { execute } from 'president';
import { InitializeEmitter, OperationState } from 'resin-device-init';

const extractStreamAsync = Promise.promisify(rindle.extract);
const waitStreamAsync = Promise.promisify(rindle.wait);
const presidentExecuteAsync = Promise.promisify(execute);

const resin = ResinSdk.fromSharedOptions();

export function getGroupDefaults(group: {
	options: { name: string; default?: string }[];
}): { [name: string]: string | undefined } {
	return _.chain(group)
		.get('options')
		.map(question => [question.name, question.default])
		.fromPairs()
		.value();
}

export function stateToString(state: OperationState) {
	const percentage = _.padStart(`${state.percentage}`, 3, '0');
	const result = `${chalk.blue(percentage + '%')} ${chalk.cyan(
		state.operation.command,
	)}`;

	switch (state.operation.command) {
		case 'copy':
			return `${result} ${state.operation.from.path} -> ${
				state.operation.to.path
			}`;
		case 'replace':
			return `${result} ${state.operation.file.path}, ${
				state.operation.copy
			} -> ${state.operation.replace}`;
		case 'run-script':
			return `${result} ${state.operation.script}`;
		default:
			throw new Error(`Unsupported operation: ${state.operation.command}`);
	}
}

export function sudo(command: string[]) {
	if (os.platform() !== 'win32') {
		console.log('If asked please type your computer password to continue');
	}

	command = _.union(_.take(process.argv, 2), command);

	return presidentExecuteAsync(command);
}

export function getManifest(
	image: string,
	deviceType: string,
): Promise<ResinSdk.DeviceType> {
	// Attempt to read manifest from the first
	// partition, but fallback to the API if
	// we encounter any errors along the way.
	return imagefs
		.read({
			image,
			partition: {
				primary: 1,
			},
			path: '/device-type.json',
		})
		.then(extractStreamAsync)
		.then(JSON.parse)
		.catch(() => resin.models.device.getManifestBySlug(deviceType));
}

export function osProgressHandler(step: InitializeEmitter) {
	step.on('stdout', process.stdout.write.bind(process.stdout));
	step.on('stderr', process.stderr.write.bind(process.stderr));

	step.on('state', function(state) {
		if (state.operation.command === 'burn') {
			return;
		}
		console.log(exports.stateToString(state));
	});

	const progressBars = {
		write: new visuals.Progress('Writing Device OS'),
		check: new visuals.Progress('Validating Device OS'),
	};

	step.on('burn', state => progressBars[state.type].update(state));

	return waitStreamAsync(step);
}

export function getArchAndDeviceType(
	applicationName: string,
): Promise<{ arch: string; device_type: string }> {
	return Promise.join(
		getApplication(applicationName),
		resin.models.config.getDeviceTypes(),
		function(app, deviceTypes) {
			const config = _.find(deviceTypes, { slug: app.device_type });

			if (!config) {
				throw new Error('Could not read application information!');
			}

			return { device_type: app.device_type, arch: config.arch };
		},
	);
}

export function getApplication(applicationName: string) {
	// Check for an app of the form `user/application`, and send
	// that off to a special handler (before importing any modules)
	const match = /(\w+)\/(\w+)/.exec(applicationName);

	const extraOptions = {
		$expand: {
			application_type: {
				$select: ['name', 'slug', 'supports_multicontainer', 'is_legacy'],
			},
		},
	};

	if (match) {
		return resin.models.application.getAppByOwner(
			match[2],
			match[1],
			extraOptions,
		);
	}

	return resin.models.application.get(applicationName, extraOptions);
}

// A function to reliably execute a command
// in all supported operating systems, including
// different Windows environments like `cmd.exe`
// and `Cygwin`.
export function getSubShellCommand(command: string) {
	if (os.platform() === 'win32') {
		return {
			program: 'cmd.exe',
			args: ['/s', '/c', command],
		};
	} else {
		return {
			program: '/bin/sh',
			args: ['-c', command],
		};
	}
}
