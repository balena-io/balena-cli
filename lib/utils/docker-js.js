/**
 * @license
 * Copyright 2017-2020 Balena Ltd.
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

// Functions to help actions which rely on using docker

import * as _ from 'lodash';
import { ExpectedError } from '../errors';

const generateConnectOpts = async function (opts) {
	const { promises: fs } = await import('fs');

	const connectOpts = {};

	// Start with docker-modem defaults which take several env vars into account,
	// including DOCKER_HOST, DOCKER_TLS_VERIFY, DOCKER_CERT_PATH, SSH_AUTH_SOCK
	// https://github.com/apocas/docker-modem/blob/v2.1.3/lib/modem.js#L15-L65
	const Modem = await import('docker-modem');
	const defaultOpts = new Modem();
	const optsOfInterest = [
		'ca',
		'cert',
		'key',
		'host',
		'port',
		'socketPath',
		'protocol',
		'username',
		'sshAuthAgent',
		'timeout',
	];
	for (const opt of optsOfInterest) {
		connectOpts[opt] = defaultOpts[opt];
	}

	// Now override the default options with any explicit command line options
	if (opts.docker != null && opts.dockerHost == null) {
		// good, local docker socket
		connectOpts.socketPath = opts.docker;
		delete connectOpts.host;
		delete connectOpts.port;
	} else if (opts.dockerHost != null && opts.docker == null) {
		// Good a host is provided, and local socket isn't
		connectOpts.host = opts.dockerHost;
		connectOpts.port = opts.dockerPort || 2376;
		delete connectOpts.socketPath;
	} else if (opts.docker != null && opts.dockerHost != null) {
		// Both provided, no obvious way to continue
		throw new ExpectedError(
			"Both a local docker socket and docker host have been provided. Don't know how to continue.",
		);
	}

	// Now need to check if the user wants to connect over TLS
	// to the host

	// If any are set...
	if (opts.ca != null || opts.cert != null || opts.key != null) {
		// but not all
		if (!(opts.ca != null && opts.cert != null && opts.key != null)) {
			throw new ExpectedError(
				'You must provide a CA, certificate and key in order to use TLS',
			);
		}

		const [ca, cert, key] = await Promise.all([
			fs.readFile(opts.ca, 'utf-8'),
			fs.readFile(opts.cert, 'utf-8'),
			fs.readFile(opts.key, 'utf-8'),
		]);
		return _.merge(connectOpts, {
			ca,
			cert,
			key,
		});
	}

	return connectOpts;
};

/**
 * @param {{
 * 	ca?: string; // path to ca (Certificate Authority) file (TLS)
 * 	cert?: string; // path to cert (Certificate) file (TLS)
 * 	key?: string; // path to key file (TLS)
 * 	docker?: string; // dockerode DockerOptions.socketPath
 * 	dockerHost?: string; // dockerode DockerOptions.host
 * 	dockerPort?: number; // dockerode DockerOptions.port
 * 	host?: string;
 * 	port?: number;
 * 	timeout?: number;
 * }} options
 * @returns {Promise<import('docker-toolbelt')>}
 */
export async function getDocker(options) {
	const connectOpts = await generateConnectOpts(options);
	const client = createClient(connectOpts);
	await ensureDockerSeemsAccessible(client);
	return client;
}

const getDockerToolbelt = _.once(function () {
	const Docker = require('docker-toolbelt');
	const Bluebird = require('bluebird');
	Bluebird.promisifyAll(Docker.prototype, {
		filter(name) {
			return name === 'run';
		},
		multiArgs: true,
	});
	Bluebird.promisifyAll(Docker.prototype);
	// @ts-ignore `getImage()` should have a param but this whole thing is a hack that should be removed
	Bluebird.promisifyAll(new Docker({}).getImage().constructor.prototype);
	// @ts-ignore `getContainer()` should have a param but this whole thing is a hack that should be removed
	Bluebird.promisifyAll(new Docker({}).getContainer().constructor.prototype);
	return Docker;
});

// docker-toolbelt v3 is not backwards compatible as it removes all *Async
// methods that are in wide use in the CLI. The workaround for now is to
// manually promisify the client and replace all `new Docker()` calls with
// this shared function that returns a promisified client.
//
//    **New code must not use the *Async methods.**
//
/**
 * @param {{
 * 	host: string;
 * 	port: number;
 * 	timeout?: number;
 * 	socketPath?: string
 * }} opts
 * @returns {import('docker-toolbelt')}
 */
export const createClient = function (opts) {
	const Docker = getDockerToolbelt();
	const docker = new Docker(opts);
	const { modem } = docker;
	// Workaround for a docker-modem 2.0.x bug where it sets a default
	// socketPath on Windows even if the input options specify a host/port.
	if (modem.socketPath && modem.host) {
		if (opts.socketPath) {
			modem.host = undefined;
			modem.port = undefined;
		} else if (opts.host) {
			modem.socketPath = undefined;
		}
	}
	return docker;
};

var ensureDockerSeemsAccessible = function (docker) {
	const { exitWithExpectedError } = require('../errors');
	return docker
		.ping()
		.catch((e) =>
			exitWithExpectedError(
				`Docker seems to be unavailable. Is it installed and running?\n${e}`,
			),
		);
};
