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
import type { parse } from '@balena/compose';

import Command from '../../command.js';
import { ExpectedError } from '../../errors.js';
import { getBalenaSdk, getChalk, stripIndent } from '../../utils/lazy.js';
import {
	dockerignoreHelp,
	registrySecretsHelp,
	buildArgDeprecation,
} from '../../utils/messages.js';
import * as ca from '../../utils/common-args.js';
import * as compose from '../../utils/compose.js';
import type {
	BuiltImage,
	ComposeCliFlags,
	ComposeOpts,
	Release as ComposeReleaseInfo,
} from '../../utils/compose-types.js';
import type { BuildOpts, DockerCliFlags } from '../../utils/docker.js';
import {
	applyReleaseTagKeysAndValues,
	buildProject,
	composeCliFlags,
	isBuildConfig,
	parseReleaseTagKeysAndValues,
} from '../../utils/compose_ts.js';
import { dockerCliFlags } from '../../utils/docker.js';
import type { ApplicationType, DeviceType, Release } from 'balena-sdk';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

interface ApplicationWithArch {
	id: number;
	arch: string;
	is_for__device_type: [Pick<DeviceType, 'slug'>];
	application_type: [Pick<ApplicationType, 'slug' | 'supports_multicontainer'>];
}

// TODO: For this special one we can't use Interfaces.InferredFlags/InferredArgs
// because of the 'registry-secrets' type which is defined in the actual code
// as a path (string | undefined) but then the cli turns it into an object
interface FlagsDef extends ComposeCliFlags, DockerCliFlags {
	source?: string;
	build: boolean;
	nologupload: boolean;
	'release-tag'?: string[];
	draft: boolean;
	note?: string;
	help: void;
}

export default class DeployCmd extends Command {
	public static description = `\
Deploy a single image or a multicontainer project to a balena fleet.

Usage: \`deploy <fleet> ([image] | --build [--source build-dir])\`

Use this command to deploy an image or a complete multicontainer project to a
fleet, optionally building it first. The source images are searched for
(and optionally built) using the docker daemon in your development machine or
balena device. (See also the \`balena push\` command for the option of building
the image in the balenaCloud build servers.)

Unless an image is specified, this command will look into the current directory
(or the one specified by --source) for a docker-compose.yml file.  If one is
found, this command will deploy each service defined in the compose file,
building it first if an image for it doesn't exist. Image names will be looked
up according to the scheme: \`<projectName>_<serviceName>\`.

If a compose file isn't found, the command will look for a Dockerfile[.template]
file (or alternative Dockerfile specified with the \`-f\` option), and if yet
that isn't found, it will try to generate one.

To deploy to a fleet where you are a collaborator, use fleet slug including the
organization:  \`balena deploy <organization>/<fleet>\`.

${registrySecretsHelp}

${dockerignoreHelp}
`;

	public static examples = [
		'$ balena deploy myFleet',
		'$ balena deploy myorg/myfleet --build --source myBuildDir/',
		'$ balena deploy myorg/myfleet --build --source myBuildDir/ --note "this is the note for this release"',
		'$ balena deploy myorg/myfleet myRepo/myImage',
		'$ balena deploy myFleet myRepo/myImage --release-tag key1 "" key2 "value2 with spaces"',
	];

	public static args = {
		fleet: ca.fleetRequired,
		image: Args.string({ description: 'the image to deploy' }),
	};

	public static usage = 'deploy <fleet> [image]';

	public static flags = {
		source: Flags.string({
			description:
				'specify an alternate source directory; default is the working directory',
			char: 's',
		}),
		build: Flags.boolean({
			description: 'force a rebuild before deploy',
			char: 'b',
		}),
		nologupload: Flags.boolean({
			description:
				"don't upload build logs to the dashboard with image (if building)",
		}),
		'release-tag': Flags.string({
			description: stripIndent`
				Set release tags if the image deployment is successful. Multiple
				arguments may be provided, alternating tag keys and values (see examples).
				Hint: Empty values may be specified with "" (bash, cmd.exe) or '""' (PowerShell).
			`,
			multiple: true,
		}),
		draft: Flags.boolean({
			description: stripIndent`
				Deploy the release as a draft. Draft releases are ignored
				by the 'track latest' release policy but can be used through release pinning.
				Draft releases can be marked as final through the API. Releases are created
				as final by default unless this option is given.`,
			default: false,
		}),
		note: Flags.string({ description: 'The notes for this release' }),
		...composeCliFlags,
		...dockerCliFlags,
		// NOTE: Not supporting -h for help, because of clash with -h in DockerCliFlags
		// Revisit this in future release.
		help: Flags.help({}),
	};

	public static authenticated = true;

	public static primary = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(DeployCmd);

		(await import('events')).defaultMaxListeners = 1000;

		const logger = await Command.getLogger();
		logger.logDebug('Parsing input...');

		const { fleet, image } = params;

		// Build args are under consideration for removal - warn user
		if (options.buildArg) {
			console.log(buildArgDeprecation);
		}

		if (image != null && options.build) {
			throw new ExpectedError(
				'Build option is not applicable when specifying an image',
			);
		}

		const sdk = getBalenaSdk();
		const { getRegistrySecrets, validateProjectDirectory } = await import(
			'../../utils/compose_ts.js'
		);

		const { releaseTagKeys, releaseTagValues } = parseReleaseTagKeysAndValues(
			options['release-tag'] ?? [],
		);

		if (image) {
			(options as FlagsDef)['registry-secrets'] = await getRegistrySecrets(
				sdk,
				options['registry-secrets'],
			);
		} else {
			const { dockerfilePath, registrySecrets } =
				await validateProjectDirectory(sdk, {
					dockerfilePath: options.dockerfile,
					noParentCheck: options['noparent-check'] || false,
					projectPath: options.source || '.',
					registrySecretsPath: options['registry-secrets'],
				});
			options.dockerfile = dockerfilePath;
			(options as FlagsDef)['registry-secrets'] = registrySecrets;
		}

		const helpers = await import('../../utils/helpers.js');
		const app = await helpers.getAppWithArch(fleet);

		const dockerUtils = await import('../../utils/docker.js');
		const [docker, buildOpts, composeOpts] = await Promise.all([
			dockerUtils.getDocker(options),
			dockerUtils.generateBuildOpts(options as FlagsDef),
			compose.generateOpts(options),
		]);

		const release = await this.deployProject(docker, logger, composeOpts, {
			app,
			appName: fleet, // may be prefixed by 'owner/', unlike app.app_name
			image,
			shouldPerformBuild: !!options.build,
			shouldUploadLogs: !options.nologupload,
			buildEmulated: !!options.emulated,
			createAsDraft: options.draft,
			buildOpts,
		});
		await applyReleaseTagKeysAndValues(
			sdk,
			release.id,
			releaseTagKeys,
			releaseTagValues,
		);
		if (options.note) {
			await sdk.models.release.setNote(release.id, options.note);
		}
	}

	async deployProject(
		docker: import('dockerode'),
		logger: import('../../utils/logger.js').default,
		composeOpts: ComposeOpts,
		opts: {
			app: ApplicationWithArch; // the application instance to deploy to
			appName: string;
			image?: string;
			dockerfilePath?: string; // alternative Dockerfile
			shouldPerformBuild: boolean;
			shouldUploadLogs: boolean;
			buildEmulated: boolean;
			buildOpts: BuildOpts;
			createAsDraft: boolean;
		},
	) {
		const _ = await import('lodash');
		const doodles = await import('resin-doodles');
		const sdk = getBalenaSdk();
		const { deployProject: $deployProject, loadProject } = await import(
			'../../utils/compose_ts.js'
		);

		const appType = opts.app.application_type[0];

		try {
			const project = await loadProject(
				logger,
				composeOpts,
				opts.image,
				opts.buildOpts.t,
			);
			if (project.descriptors.length > 1 && !appType?.supports_multicontainer) {
				throw new ExpectedError(
					'Target fleet does not support multiple containers. Aborting!',
				);
			}

			// find which services use images that already exist locally
			let servicesToSkip: string[] = await Promise.all(
				project.descriptors.map(async function (d: parse.ImageDescriptor) {
					// unconditionally build (or pull) if explicitly requested
					if (opts.shouldPerformBuild) {
						return '';
					}
					try {
						await docker
							.getImage((isBuildConfig(d.image) ? d.image.tag : d.image) || '')
							.inspect();

						return d.serviceName;
					} catch {
						// Ignore
						return '';
					}
				}),
			);
			servicesToSkip = servicesToSkip.filter((d) => !!d);

			// multibuild takes in a composition and always attempts to
			// build or pull all services. we workaround that here by
			// passing a modified composition.
			const compositionToBuild = _.cloneDeep(project.composition);
			compositionToBuild.services = _.omit(
				compositionToBuild.services,
				servicesToSkip,
			);
			let builtImagesByService: Dictionary<BuiltImage> = {};
			if (_.size(compositionToBuild.services) === 0) {
				logger.logInfo(
					'Everything is up to date (use --build to force a rebuild)',
				);
			} else {
				const builtImages = await buildProject({
					docker,
					logger,
					projectPath: project.path,
					projectName: project.name,
					composition: compositionToBuild,
					arch: opts.app.arch,
					deviceType: opts.app.is_for__device_type[0].slug,
					emulated: opts.buildEmulated,
					buildOpts: opts.buildOpts,
					inlineLogs: composeOpts.inlineLogs,
					convertEol: composeOpts.convertEol,
					dockerfilePath: composeOpts.dockerfilePath,
					multiDockerignore: composeOpts.multiDockerignore,
				});
				builtImagesByService = _.keyBy(builtImages, 'serviceName');
			}

			const images: BuiltImage[] = project.descriptors.map(
				(d: parse.ImageDescriptor) =>
					builtImagesByService[d.serviceName] ?? {
						serviceName: d.serviceName,
						name: (isBuildConfig(d.image) ? d.image.tag : d.image) || '',
						logs: 'Build skipped; image for service already exists.',
						props: {},
					},
			);

			let release: Release | ComposeReleaseInfo['release'];
			if (appType.slug === 'legacy-v1' || appType.slug === 'legacy-v2') {
				const { deployLegacy } = require('../../utils/deploy-legacy');

				const msg = getChalk().yellow(
					'Target fleet requires legacy deploy method.',
				);
				logger.logWarn(msg);

				const [token, { username }, url, options] = await Promise.all([
					sdk.auth.getToken(),
					sdk.auth.getUserInfo(),
					sdk.settings.get('balenaUrl'),
					{
						// opts.appName may be prefixed by 'owner/', unlike opts.app.app_name
						appName: opts.appName,
						imageName: images[0].name,
						buildLogs: images[0].logs,
						shouldUploadLogs: opts.shouldUploadLogs,
					},
				]);
				const releaseId = await deployLegacy(
					docker,
					logger,
					token,
					username,
					url,
					options,
				);

				release = await sdk.models.release.get(releaseId, {
					$select: ['commit'],
				});
			} else {
				// @ts-expect-error CHECK ESM
				release = await $deployProject(
					docker,
					sdk,
					logger,
					project.composition,
					images,
					opts.app.id,
					!opts.shouldUploadLogs,
					composeOpts.projectPath,
					opts.createAsDraft,
				);
			}

			logger.outputDeferredMessages();
			logger.logSuccess('Deploy succeeded!');
			logger.logSuccess(`Release: ${release.commit}`);
			console.log();
			console.log(doodles.getDoodle()); // Show charlie
			console.log();
			return release;
		} catch (err) {
			logger.logError('Deploy failed');
			throw err;
		}
	}
}
