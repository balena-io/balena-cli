/**
 * @license
 * Copyright 2018-2019 Balena Ltd.
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
import { flags } from '@oclif/command';

import { ExpectedError } from '../errors';
import { parseAsInteger } from './validation';

export * from './docker-js';

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

export const dockerConnectionCliFlags: flags.Input<DockerConnectionCliFlags> = {
	docker: flags.string({
		description: 'Path to a local docker socket (e.g. /var/run/docker.sock)',
		char: 'P',
	}),
	dockerHost: flags.string({
		description:
			'Docker daemon hostname or IP address (dev machine or balena device) ',
		char: 'h',
	}),
	dockerPort: flags.integer({
		description:
			'Docker daemon TCP port number (hint: 2375 for balena devices)',
		char: 'p',
		parse: (p) => parseAsInteger(p, 'dockerPort'),
	}),
	ca: flags.string({
		description: 'Docker host TLS certificate authority file',
	}),
	cert: flags.string({
		description: 'Docker host TLS certificate file',
	}),
	key: flags.string({
		description: 'Docker host TLS key file',
	}),
};

export const dockerCliFlags: flags.Input<DockerCliFlags> = {
	tag: flags.string({
		description: 'The alias to the generated image',
		char: 't',
	}),
	buildArg: flags.string({
		description:
			'Set a build-time variable (eg. "-B \'ARG=value\'"). Can be specified multiple times.',
		char: 'B',
		multiple: true,
	}),
	'cache-from': flags.string({
		description: `\
Comma-separated list (no spaces) of image names for build cache resolution. \
Implements the same feature as the "docker build --cache-from" option.`,
	}),
	nocache: flags.boolean({
		description: "Don't use docker layer caching when building",
	}),
	pull: flags.boolean({
		description: 'Pull the base images again even if they exist locally',
	}),
	squash: flags.boolean({
		description: 'Squash newly built layers into a single new layer',
	}),
	...dockerConnectionCliFlags,
};

export interface BuildOpts {
	buildargs?: Dictionary<string>;
	cachefrom?: string[];
	nocache?: boolean;
	pull?: boolean;
	registryconfig?: import('resin-multibuild').RegistrySecrets;
	squash?: boolean;
	t?: string;
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
	'registry-secrets'?: import('resin-multibuild').RegistrySecrets;
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

/** Detect whether the docker daemon is balenaEngine */
export async function isBalenaEngine(docker: dockerode): Promise<boolean> {
	const dockerVersion = await getDockerVersion(docker);
	return !!(
		// dockerVersion.Engine should be 'balena-engine' for the current
		// version of balenaEngine, but at one point it was spelt 'balaena':
		// https://github.com/balena-os/balena-engine/pull/32/files
		(dockerVersion.Engine && dockerVersion.Engine.match(/balena|balaena/))
	);
}

/** Detect whether the docker daemon is Docker Desktop (Windows or Mac) */
export async function isDockerDesktop(
	docker: dockerode,
): Promise<[boolean, any]> {
	// Docker Desktop (Windows and Mac) with Docker Engine 19.03 reports:
	//     OperatingSystem: Docker Desktop
	//     OSType: linux
	// Docker for Mac with Docker Engine 18.06 reports:
	//     OperatingSystem: Docker for Mac
	//     OSType: linux
	// On Ubuntu (standard Docker installation):
	//     OperatingSystem: Ubuntu 18.04.2 LTS (containerized)
	//     OSType: linux
	// https://stackoverflow.com/questions/38223965/how-can-i-detect-if-docker-for-mac-is-installed
	//
	const dockerInfo = await getDockerInfo(docker);
	const isDD = /(?:Docker Desktop)|(?:Docker for Mac)/i.test(
		dockerInfo.OperatingSystem,
	);
	return [isDD, dockerInfo];
}

/**
 * Convert a Docker arch identifier to a balena arch identifier.
 * @param engineArch One of the GOARCH values (used by Docker) listed at:
 * https://golang.org/doc/install/source#environment
 */
export function asBalenaArch(engineArch: string): string {
	const archs: { [arch: string]: string } = {
		arm: 'armv7hf', // could also be 'rpi' though
		arm64: 'aarch64',
		amd64: 'amd64',
		'386': 'i386',
	};
	return archs[engineArch] || '';
}

/**
 * Determine whether the given balena arch identifier and the given
 * Docker arch identifier represent compatible architectures.
 * @param balenaArch One of: rpi, armv7hf, amd64, i386
 * @param engineArch One of the GOARCH values: arm, arm64, amd64, 386
 */
export function isCompatibleArchitecture(
	balenaArch: string,
	engineArch: string,
): boolean {
	return (
		(balenaArch === 'rpi' && engineArch === 'arm') ||
		balenaArch === asBalenaArch(engineArch)
	);
}

let cachedDockerInfo: any;
let cachedDockerVersion: BalenaEngineVersion;

export async function getDockerInfo(docker: dockerode): Promise<any> {
	if (cachedDockerInfo == null) {
		cachedDockerInfo = await docker.info();
	}
	return cachedDockerInfo;
}

export async function getDockerVersion(
	docker: dockerode,
): Promise<BalenaEngineVersion> {
	if (cachedDockerVersion == null) {
		cachedDockerVersion = await docker.version();
	}
	return cachedDockerVersion;
}
