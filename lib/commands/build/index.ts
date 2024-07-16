/**
 * @license
 * Copyright 2016-2021 Balena Ltd.
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

import { Args, Flags } from '@oclif/core';
import Command from '../../command.js';
import { getBalenaSdk } from '../../utils/lazy.js';
import * as cf from '../../utils/common-flags.js';
import * as compose from '../../utils/compose.js';
import type {
	ApplicationType,
	BalenaSDK,
	DeviceType,
	PineOptions,
	PineTypedResult,
} from 'balena-sdk';
import {
	buildArgDeprecation,
	dockerignoreHelp,
	registrySecretsHelp,
} from '../../utils/messages.js';
import type {
	ComposeCliFlags,
	ComposeOpts,
} from '../../utils/compose-types.js';
import { buildProject, composeCliFlags } from '../../utils/compose_ts.js';
import type { BuildOpts, DockerCliFlags } from '../../utils/docker.js';
import { dockerCliFlags } from '../../utils/docker.js';
import type Dockerode from 'dockerode';

// TODO: For this special one we can't use Interfaces.InferredFlags/InferredArgs
// because of the 'registry-secrets' type which is defined in the actual code
// as a path (string | undefined) but then the cli turns it into an object
interface FlagsDef extends ComposeCliFlags, DockerCliFlags {
	arch?: string;
	deviceType?: string;
	fleet?: string;
	source?: string; // Not part of command profile - source param copied here.
	help: void;
}

export default class BuildCmd extends Command {
	public static description = `\
Build a project locally.

Use this command to build an image or a complete multicontainer project with
the provided docker daemon in your development machine or balena device.
(See also the \`balena push\` command for the option of building images in the
balenaCloud build servers.)

You must specify either a fleet, or the device type and architecture.

This command will look into the given source directory (or the current working
directory if one isn't specified) for a docker-compose.yml file, and if found,
each service defined in the compose file will be built. If a compose file isn't
found, it will look for a Dockerfile[.template] file (or alternative Dockerfile
specified with the \`--dockerfile\` option), and if no dockerfile is found, it
will try to generate one.

${registrySecretsHelp}

${dockerignoreHelp}
`;
	public static examples = [
		'$ balena build --fleet myFleet',
		'$ balena build ./source/ --fleet myorg/myfleet',
		'$ balena build --deviceType raspberrypi3 --emulated',
		'$ balena build --deviceType raspberrypi3 --arch armv7hf --emulated',
		'$ balena build --docker /var/run/docker.sock --fleet myFleet   # Linux, Mac',
		'$ balena build --docker //./pipe/docker_engine --fleet myFleet # Windows',
		'$ balena build --dockerHost my.docker.host --dockerPort 2376 --ca ca.pem --key key.pem --cert cert.pem -f myFleet',
	];

	public static args = {
		source: Args.string({ description: 'path of project source directory' }),
	};

	public static usage = 'build [source]';

	public static flags = {
		arch: Flags.string({
			description: 'the architecture to build for',
			char: 'A',
		}),
		deviceType: Flags.string({
			description: 'the type of device this build is for',
			char: 'd',
		}),
		fleet: cf.fleet,
		...composeCliFlags,
		...dockerCliFlags,
		// NOTE: Not supporting -h for help, because of clash with -h in DockerCliFlags
		// Revisit this in future release.
		help: Flags.help({}),
	};

	public static primary = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(BuildCmd);

		await Command.checkLoggedInIf(!!options.fleet);

		(await import('events')).defaultMaxListeners = 1000;

		const sdk = getBalenaSdk();

		const logger = await Command.getLogger();
		logger.logDebug('Parsing input...');

		// `build` accepts `source` as a parameter, but compose expects it as an option
		options.source = params.source;
		delete params.source;

		await this.resolveArchFromDeviceType(sdk, options);

		await this.validateOptions(options, sdk);

		// Build args are under consideration for removal - warn user
		if (options.buildArg) {
			console.log(buildArgDeprecation);
		}

		const app = await this.getAppAndResolveArch(options);

		const { docker, buildOpts, composeOpts } = await this.prepareBuild(options);

		try {
			await this.buildProject(docker, logger, composeOpts, {
				appType: app?.application_type?.[0],
				arch: options.arch!,
				deviceType: options.deviceType!,
				buildEmulated: options.emulated,
				buildOpts,
			});
		} catch (err) {
			logger.logError('Build failed.');
			throw err;
		}

		logger.outputDeferredMessages();
		logger.logSuccess('Build succeeded!');
	}

	protected async validateOptions(opts: FlagsDef, sdk: BalenaSDK) {
		// Validate option combinations
		if (
			(opts.fleet == null && (opts.arch == null || opts.deviceType == null)) ||
			(opts.fleet != null && (opts.arch != null || opts.deviceType != null))
		) {
			const { ExpectedError } = await import('../../errors.js');
			throw new ExpectedError(
				'You must specify either a fleet (-f), or the device type (-d) and optionally the architecture (-A)',
			);
		}

		// Validate project directory
		const { validateProjectDirectory } = await import(
			'../../utils/compose_ts.js'
		);
		const { dockerfilePath, registrySecrets } = await validateProjectDirectory(
			sdk,
			{
				dockerfilePath: opts.dockerfile,
				noParentCheck: opts['noparent-check'] || false,
				projectPath: opts.source || '.',
				registrySecretsPath: opts['registry-secrets'],
			},
		);

		opts.dockerfile = dockerfilePath;
		opts['registry-secrets'] = registrySecrets;
	}

	protected async resolveArchFromDeviceType(sdk: BalenaSDK, opts: FlagsDef) {
		if (opts.deviceType != null && opts.arch == null) {
			try {
				const deviceTypeOpts = {
					$select: 'is_of__cpu_architecture',
					$expand: {
						is_of__cpu_architecture: {
							$select: 'slug',
						},
					},
				} satisfies PineOptions<DeviceType>;
				opts.arch = (
					(await sdk.models.deviceType.get(
						opts.deviceType,
						deviceTypeOpts,
					)) as PineTypedResult<DeviceType, typeof deviceTypeOpts>
				).is_of__cpu_architecture[0].slug;
			} catch (err) {
				const { ExpectedError } = await import('../../errors.js');
				if (err instanceof sdk.errors.BalenaInvalidDeviceType) {
					let message = err.message;
					if (!(await sdk.auth.isLoggedIn())) {
						message = `${message}. In case you are trying to use a private device type, please try to log in first.`;
					}
					throw new ExpectedError(message);
				}
				throw new ExpectedError(
					'Failed to resolve the architecture of the provided device type. If you are in an air-gapped environment please also define the architecture (-A) parameter.',
				);
			}
		}
	}

	protected async getAppAndResolveArch(opts: FlagsDef) {
		if (opts.fleet) {
			const { getAppWithArch } = await import('../../utils/helpers.js');
			const app = await getAppWithArch(opts.fleet);
			opts.arch = app.arch;
			opts.deviceType = app.is_for__device_type[0].slug;
			return app;
		}
	}

	protected async prepareBuild(options: FlagsDef): Promise<{
		docker: Dockerode;
		buildOpts: BuildOpts;
		composeOpts: ComposeOpts;
	}> {
		const { getDocker, generateBuildOpts } = await import(
			'../../utils/docker.js'
		);
		const [docker, buildOpts, composeOpts] = await Promise.all([
			getDocker(options),
			generateBuildOpts(options),
			compose.generateOpts(options),
		]);
		return {
			docker,
			buildOpts,
			composeOpts,
		};
	}

	/**
	 * Opts must be an object with the following keys:
	 *   app: the app this build is for (optional)
	 *   arch: the architecture to build for
	 *   deviceType: the device type to build for
	 *   buildEmulated
	 *   buildOpts: arguments to forward to docker build command
	 *
	 * @param {Dockerode} docker
	 * @param {Logger} logger
	 * @param {ComposeOpts} composeOpts
	 * @param opts
	 */
	protected async buildProject(
		docker: import('dockerode'),
		logger: import('../../utils/logger.js').default,
		composeOpts: ComposeOpts,
		opts: {
			appType?: Pick<ApplicationType, 'supports_multicontainer'>;
			arch: string;
			deviceType: string;
			buildEmulated: boolean;
			buildOpts: BuildOpts;
		},
	) {
		const { loadProject } = await import('../../utils/compose_ts.js');

		const project = await loadProject(
			logger,
			composeOpts,
			undefined,
			opts.buildOpts.t,
		);

		if (
			opts.appType != null &&
			project.descriptors.length > 1 &&
			!opts.appType.supports_multicontainer
		) {
			logger.logWarn(
				'Target fleet does not support multiple containers.\n' +
					'Continuing with build, but you will not be able to deploy.',
			);
		}

		await buildProject({
			docker,
			logger,
			projectPath: project.path,
			projectName: project.name,
			composition: project.composition,
			arch: opts.arch,
			deviceType: opts.deviceType,
			emulated: opts.buildEmulated,
			buildOpts: opts.buildOpts,
			inlineLogs: composeOpts.inlineLogs,
			convertEol: composeOpts.convertEol,
			dockerfilePath: composeOpts.dockerfilePath,
			multiDockerignore: composeOpts.multiDockerignore,
		});
	}
}
