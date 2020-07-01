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

// Use this function to seed an action's list of capitano options
// with the docker options. Using this interface means that
// all functions using docker will expose the same interface
//
// NOTE: Care MUST be taken when using the function, so as to
// not redefine/override options already provided.
export const appendConnectionOptions = (opts) =>
	opts.concat([
		{
			signature: 'docker',
			parameter: 'docker',
			description: 'Path to a local docker socket (e.g. /var/run/docker.sock)',
			alias: 'P',
		},
		{
			signature: 'dockerHost',
			parameter: 'dockerHost',
			description:
				'Docker daemon hostname or IP address (dev machine or balena device) ',
			alias: 'h',
		},
		{
			signature: 'dockerPort',
			parameter: 'dockerPort',
			description:
				'Docker daemon TCP port number (hint: 2375 for balena devices)',
			alias: 'p',
		},
		{
			signature: 'ca',
			parameter: 'ca',
			description: 'Docker host TLS certificate authority file',
		},
		{
			signature: 'cert',
			parameter: 'cert',
			description: 'Docker host TLS certificate file',
		},
		{
			signature: 'key',
			parameter: 'key',
			description: 'Docker host TLS key file',
		},
	]);

// Use this function to seed an action's list of capitano options
// with the docker options. Using this interface means that
// all functions using docker will expose the same interface
//
// NOTE: Care MUST be taken when using the function, so as to
// not redefine/override options already provided.
export function appendOptions(opts) {
	return appendConnectionOptions(opts).concat([
		{
			signature: 'tag',
			parameter: 'tag',
			description: 'The alias to the generated image',
			alias: 't',
		},
		{
			signature: 'buildArg',
			parameter: 'arg',
			description:
				'Set a build-time variable (eg. "-B \'ARG=value\'"). Can be specified multiple times.',
			alias: 'B',
		},
		{
			signature: 'cache-from',
			parameter: 'image-list',
			description: `\
Comma-separated list (no spaces) of image names for build cache resolution. \
Implements the same feature as the "docker build --cache-from" option.`,
		},
		{
			signature: 'nocache',
			description: "Don't use docker layer caching when building",
			boolean: true,
		},
		{
			signature: 'squash',
			description: 'Squash newly built layers into a single new layer',
			boolean: true,
		},
	]);
}

const generateConnectOpts = function (opts) {
	const { promises: fs } = require('fs');
	const Bluebird = require('bluebird');

	return Bluebird.try(function () {
		const connectOpts = {};
		// Firsly need to decide between a local docker socket
		// and a host available over a host:port combo
		if (opts.docker != null && opts.dockerHost == null) {
			// good, local docker socket
			connectOpts.socketPath = opts.docker;
		} else if (opts.dockerHost != null && opts.docker == null) {
			// Good a host is provided, and local socket isn't
			connectOpts.host = opts.dockerHost;
			connectOpts.port = opts.dockerPort || 2376;
		} else if (opts.docker != null && opts.dockerHost != null) {
			// Both provided, no obvious way to continue
			throw new ExpectedError(
				"Both a local docker socket and docker host have been provided. Don't know how to continue.",
			);
		} else {
			// Use docker-modem defaults which take the DOCKER_HOST env var into account
			// https://github.com/apocas/docker-modem/blob/v2.0.2/lib/modem.js#L16-L65
			const Modem = require('docker-modem');
			const defaultOpts = new Modem();
			for (let opt of ['host', 'port', 'socketPath']) {
				connectOpts[opt] = defaultOpts[opt];
			}
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

			const certBodies = {
				ca: fs.readFile(opts.ca, 'utf-8'),
				cert: fs.readFile(opts.cert, 'utf-8'),
				key: fs.readFile(opts.key, 'utf-8'),
			};
			return Bluebird.props(certBodies).then((toMerge) =>
				_.merge(connectOpts, toMerge),
			);
		}

		return connectOpts;
	});
};

const parseBuildArgs = function (args) {
	if (!Array.isArray(args)) {
		args = [args];
	}
	const buildArgs = {};
	args.forEach(function (arg) {
		// note: [^] matches any character, including line breaks
		const pair = /^([^\s]+?)=([^]*)$/.exec(arg);
		if (pair != null) {
			buildArgs[pair[1]] = pair[2] ?? '';
		} else {
			throw new ExpectedError(`Could not parse build argument: '${arg}'`);
		}
	});
	return buildArgs;
};

export function generateBuildOpts(options) {
	const opts = {};
	if (options.tag != null) {
		opts.t = options.tag;
	}
	if (options.nocache != null) {
		opts.nocache = true;
	}
	if (options['cache-from']?.trim()) {
		opts.cachefrom = options['cache-from'].split(',').filter((i) => !!i.trim());
	}
	if (options.squash != null) {
		opts.squash = true;
	}
	if (options.buildArg != null) {
		opts.buildargs = parseBuildArgs(options.buildArg);
	}
	if (!_.isEmpty(options['registry-secrets'])) {
		opts.registryconfig = options['registry-secrets'];
	}
	return opts;
}
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
export function getDocker(options) {
	return generateConnectOpts(options)
		.then(createClient)
		.tap(ensureDockerSeemsAccessible);
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
		.catch(() =>
			exitWithExpectedError(
				'Docker seems to be unavailable. Is it installed and running?',
			),
		);
};
