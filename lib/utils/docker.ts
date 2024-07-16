/**
 * @license
 * Copyright 2018-2021 Balena Ltd.
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

import type * as dockerode from 'dockerode';
import { Flags } from '@oclif/core';

import { ExpectedError } from '../errors.js';
import { parseAsInteger } from './validation.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

interface BalenaEngineVersion extends dockerode.DockerVersion {
	Engine?: string;
}

export interface DockerConnectionCliFlags {
	docker?: string;
	dockerHost?: string;
	dockerPort?: number;
	ca?: string;
	cert?: string;
	key?: string;
}

export interface DockerCliFlags extends DockerConnectionCliFlags {
	tag?: string;
	buildArg?: string[];
	'cache-from'?: string;
	nocache: boolean;
	pull?: boolean;
	squash: boolean;
}

export const dockerConnectionCliFlags = {
	docker: Flags.string({
		description: 'Path to a local docker socket (e.g. /var/run/docker.sock)',
		char: 'P',
	}),
	dockerHost: Flags.string({
		description:
			'Docker daemon hostname or IP address (dev machine or balena device) ',
		char: 'h',
	}),
	dockerPort: Flags.integer({
		description:
			'Docker daemon TCP port number (hint: 2375 for balena devices)',
		char: 'p',
		parse: async (p) => parseAsInteger(p, 'dockerPort'),
	}),
	ca: Flags.string({
		description: 'Docker host TLS certificate authority file',
	}),
	cert: Flags.string({
		description: 'Docker host TLS certificate file',
	}),
	key: Flags.string({
		description: 'Docker host TLS key file',
	}),
};

export const dockerCliFlags = {
	tag: Flags.string({
		description: `\
Tag locally built Docker images. This is the 'tag' portion
in 'projectName_serviceName:tag'. The default is 'latest'.`,
		char: 't',
	}),
	buildArg: Flags.string({
		description:
			'[Deprecated] Set a build-time variable (eg. "-B \'ARG=value\'"). Can be specified multiple times.',
		char: 'B',
		multiple: true,
	}),
	'cache-from': Flags.string({
		description: `\
Comma-separated list (no spaces) of image names for build cache resolution. \
Implements the same feature as the "docker build --cache-from" option.`,
	}),
	nocache: Flags.boolean({
		description: "Don't use docker layer caching when building",
	}),
	pull: Flags.boolean({
		description: 'Pull the base images again even if they exist locally',
	}),
	squash: Flags.boolean({
		description: 'Squash newly built layers into a single new layer',
	}),
	...dockerConnectionCliFlags,
};

export interface BuildOpts {
	buildargs?: Dictionary<string>;
	cachefrom?: string[];
	nocache?: boolean;
	pull?: boolean;
	registryconfig?: import('@balena/compose/dist/multibuild').RegistrySecrets;
	squash?: boolean;
	t?: string; // only the tag portion of the image name, e.g. 'abc' in 'myimg:abc'
}

function parseBuildArgs(args: string[]): Dictionary<string> {
	if (!Array.isArray(args)) {
		args = [args];
	}
	const buildArgs: Dictionary<string> = {};
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
}

export function generateBuildOpts(options: {
	buildArg?: string[];
	'cache-from'?: string;
	nocache: boolean;
	pull?: boolean;
	'registry-secrets'?: import('@balena/compose/dist/multibuild').RegistrySecrets;
	squash: boolean;
	tag?: string;
}): BuildOpts {
	const opts: BuildOpts = {};
	if (options.buildArg != null) {
		opts.buildargs = parseBuildArgs(options.buildArg);
	}
	if (options['cache-from']?.trim()) {
		opts.cachefrom = options['cache-from'].split(',').filter((i) => !!i.trim());
	}
	if (options.nocache != null) {
		opts.nocache = true;
	}
	if (options.pull != null) {
		opts.pull = true;
	}
	if (
		options['registry-secrets'] &&
		Object.keys(options['registry-secrets']).length
	) {
		opts.registryconfig = options['registry-secrets'];
	}
	if (options.squash != null) {
		opts.squash = true;
	}
	if (options.tag != null) {
		opts.t = options.tag;
	}
	return opts;
}

export async function isBalenaEngine(docker: dockerode): Promise<boolean> {
	// dockerVersion.Engine should equal 'balena-engine' for the current/latest
	// version of balenaEngine, but it was at one point (mis)spelt 'balaena':
	// https://github.com/balena-os/balena-engine/pull/32/files
	const dockerVersion = (await docker.version()) as BalenaEngineVersion;
	return !!(
		dockerVersion.Engine && dockerVersion.Engine.match(/balena|balaena/)
	);
}

export async function getDocker(
	options: DockerConnectionCliFlags,
): Promise<dockerode> {
	const connectOpts = await generateConnectOpts(options);
	const client = await createClient(connectOpts);
	await checkThatDockerIsReachable(client);
	return client;
}

export async function createClient(
	opts: dockerode.DockerOptions,
): Promise<dockerode> {
	const { default: Docker } = await import('dockerode');
	return new Docker(opts);
}

/**
 * Initialize Docker connection options with the default values from the
 * 'docker-modem' package, which takes several env vars into account,
 * including DOCKER_HOST, DOCKER_TLS_VERIFY, DOCKER_CERT_PATH, SSH_AUTH_SOCK
 * https://github.com/apocas/docker-modem/blob/v3.0.0/lib/modem.js#L15-L70
 *
 * @param opts Command line options like --dockerHost and --dockerPort
 */
export function getDefaultDockerModemOpts(
	opts: DockerConnectionCliFlags,
): dockerode.DockerOptions {
	const connectOpts: dockerode.DockerOptions = {};
	const optsOfInterest: Array<keyof dockerode.DockerOptions> = [
		'ca',
		'cert',
		'key',
		'host',
		'port',
		'socketPath',
		'protocol',
		'username',
		'timeout',
	];
	const Modem = require('docker-modem');
	const originalDockerHost = process.env.DOCKER_HOST;
	try {
		if (opts.dockerHost) {
			process.env.DOCKER_HOST ||= opts.dockerPort
				? `${opts.dockerHost}:${opts.dockerPort}`
				: opts.dockerHost;
		}
		const defaultOpts = new Modem();
		for (const opt of optsOfInterest) {
			connectOpts[opt] = defaultOpts[opt];
		}
	} finally {
		// Did you know? Any value assigned to `process.env.XXX` becomes a string.
		// For example, `process.env.DOCKER_HOST = undefined` results in
		// value 'undefined' (a 9-character string) being assigned.
		if (originalDockerHost) {
			process.env.DOCKER_HOST = originalDockerHost;
		} else {
			delete process.env.DOCKER_HOST;
		}
	}
	return connectOpts;
}

export async function generateConnectOpts(opts: DockerConnectionCliFlags) {
	let connectOpts = getDefaultDockerModemOpts(opts);

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

	// Process TLS options
	// These should be file paths (strings)
	const tlsOpts = [opts.ca, opts.cert, opts.key];

	// If any tlsOpts are set...
	if (tlsOpts.some((opt) => opt)) {
		// but not all
		if (!tlsOpts.every((opt) => opt)) {
			throw new ExpectedError(
				'You must provide a CA, certificate and key in order to use TLS',
			);
		}
		if (!isStringArray(tlsOpts)) {
			throw new ExpectedError(
				'TLS options (CA, certificate and key) must be file paths (strings)',
			);
		}
		const { promises: fs } = await import('fs');
		const [ca, cert, key] = await Promise.all(
			tlsOpts.map((opt: string) => fs.readFile(opt, 'utf8')),
		);
		// Also ensure that the protocol is 'https' like 'docker-modem' does:
		// https://github.com/apocas/docker-modem/blob/v3.0.0/lib/modem.js#L101-L103
		// TODO: delete redundant logic from this function now that similar logic
		// exists in the 'docker-modem' package.
		connectOpts = { ...connectOpts, ca, cert, key, protocol: 'https' };
	}

	return connectOpts;
}

// TypeScript "type guard" with "type predicate"
function isStringArray(array: any[]): array is string[] {
	return array.every((opt) => typeof opt === 'string');
}

async function checkThatDockerIsReachable(docker: dockerode) {
	try {
		await docker.ping();
	} catch (e) {
		throw new ExpectedError(
			`Docker seems to be unavailable. Is it installed and running?\n${e}`,
		);
	}
}
