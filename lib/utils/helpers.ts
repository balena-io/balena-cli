/*
Copyright 2016-2019 Balena

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

import BalenaSdk = require('balena-sdk');
import Bluebird = require('bluebird');
import chalk from 'chalk';
import _ = require('lodash');
import os = require('os');
import visuals = require('resin-cli-visuals');
import rindle = require('rindle');

import { InitializeEmitter, OperationState } from 'balena-device-init';

const waitStreamAsync = Bluebird.promisify(rindle.wait);
const balena = BalenaSdk.fromSharedOptions();

export function getGroupDefaults(group: {
	options: Array<{ name: string; default?: string }>;
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

export function sudo(
	command: string[],
	{ stderr, msg }: { stderr?: NodeJS.WritableStream; msg?: string } = {},
) {
	const { executeWithPrivileges } = require('./sudo');

	if (os.platform() !== 'win32') {
		console.log(
			msg || 'If asked please type your computer password to continue',
		);
	}

	return executeWithPrivileges(command, stderr);
}

export function runCommand(command: string): Bluebird<void> {
	const capitano = require('capitano');
	return Bluebird.fromCallback(resolver => capitano.run(command, resolver));
}

export async function getManifest(
	image: string,
	deviceType: string,
): Promise<BalenaSdk.DeviceType> {
	const init = await import('balena-device-init');
	const manifest = await init.getImageManifest(image);
	if (manifest != null) {
		return manifest;
	}
	return balena.models.device.getManifestBySlug(deviceType);
}

export const areDeviceTypesCompatible = (
	deviceTypeA: BalenaSdk.DeviceType,
	deviceTypeB: BalenaSdk.DeviceType,
) =>
	deviceTypeA.arch === deviceTypeB.arch &&
	!!deviceTypeA.isDependent === !!deviceTypeB.isDependent;

export async function getOsVersion(
	image: string,
	manifest: BalenaSdk.DeviceType,
): Promise<string | null> {
	const init = await import('balena-device-init');
	return init.getImageOsVersion(image, manifest);
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
): Bluebird<{ arch: string; device_type: string }> {
	return Bluebird.join(
		getApplication(applicationName),
		balena.models.config.getDeviceTypes(),
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
	const match = applicationName.split('/');

	const extraOptions = {
		$expand: {
			application_type: {
				$select: ['name', 'slug', 'supports_multicontainer', 'is_legacy'],
			},
		},
	};

	if (match.length > 1) {
		return balena.models.application.getAppByOwner(
			match[1],
			match[0],
			extraOptions,
		);
	}

	return balena.models.application.get(applicationName, extraOptions);
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

/**
 * Call `func`, and if func() throws an error or returns a promise that
 * eventually rejects, retry it `times` many times, each time printing a
 * log message including the given `label` and the error that led to
 * retrying. Wait delayMs before the first retry, multiplying the wait
 * by backoffScaler for each further attempt.
 * @param func: The function to call and, if needed, retry calling
 * @param times: How many times to retry calling func()
 * @param label: Label to include in the retry log message
 * @param delayMs: How long to wait before the first retry
 * @param backoffScaler: Multiplier to previous wait time
 * @param count: Used "internally" for the recursive calls
 */
export function retry<T>(
	func: () => T,
	times: number,
	label: string,
	delayMs = 1000,
	backoffScaler = 2,
	count = 0,
): Bluebird<T> {
	let promise = Bluebird.try(func);
	if (count < times) {
		promise = promise.catch((err: Error) => {
			const delay = backoffScaler ** count * delayMs;
			console.log(
				`Retrying "${label}" after ${(delay / 1000).toFixed(2)}s (${count +
					1} of ${times}) due to: ${err}`,
			);
			return Bluebird.delay(delay).then(() =>
				retry(func, times, label, delayMs, backoffScaler, count + 1),
			);
		});
	}
	return promise;
}

/**
 * Return a compare(a, b) function suitable for use as the argument for the
 * sort() method of an array. That function will use the given manuallySortedArray
 * as "sorting guidance":
 *   - If both a and b are found in the manuallySortedArray, the returned
 *     compare(a, b) function will follow that ordering.
 *   - If neither a nor b are found in the manuallySortedArray, the returned
 *     compare(a, b) function will compare a and b using the standard '<' and
 *     '>' Javascript operators.
 *   - If only a or only b are found in the manuallySortedArray, the returned
 *     compare(a, b) function will consider the found element as being
 *     "smaller than" the not-found element (i.e. found elements appeare before
 *     not-found elements in sorted order).
 *
 * The equalityFunc() argument is a function used to compare the array items
 * against the manuallySortedArray. For example, if equalityFunc was (a, x) =>
 * a.startsWith(x), where a is an item being sorted and x is an item in the
 * manuallySortedArray, then the manuallySortedArray could contain prefix
 * substrings to guide the sorting.
 *
 * @param manuallySortedArray A pre-sorted array to guide the sorting
 * @param equalityFunc An optional function used to compare the items being
 *   sorted against items in manuallySortedArray. It should return true if
 *   the two items compare equal, otherwise false. The arguments are the
 *   same as provided by the standard Javascript array.findIndex() method.
 */
export function getManualSortCompareFunction<T, U = T>(
	manuallySortedArray: U[],
	equalityFunc: (a: T, x: U, index: number, array: U[]) => boolean,
): (a: T, b: T) => number {
	return function(a: T, b: T): number {
		const indexA = manuallySortedArray.findIndex((x, index, array) =>
			equalityFunc(a, x, index, array),
		);
		const indexB = manuallySortedArray.findIndex((x, index, array) =>
			equalityFunc(b, x, index, array),
		);
		if (indexA >= 0 && indexB >= 0) {
			return indexA - indexB;
		} else if (indexA < 0 && indexB < 0) {
			return a < b ? -1 : a > b ? 1 : 0;
		} else {
			return indexA < 0 ? 1 : -1;
		}
	};
}
