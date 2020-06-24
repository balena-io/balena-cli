/**
 * @license
 * Copyright 2016-2020 Balena Ltd.
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

// Imported here because it's needed for the setup
// of this action
import * as Bluebird from 'bluebird';

import * as dockerUtils from '../utils/docker';
import * as compose from '../utils/compose';
import { dockerignoreHelp, registrySecretsHelp } from '../utils/messages';
import { ExpectedError } from '../errors';
import { getBalenaSdk, getChalk } from '../utils/lazy';

/**
 * Opts must be an object with the following keys:
 *   app: the application instance to deploy to
 *   image: the image to deploy; optional
 *   dockerfilePath: name of an alternative Dockerfile; optional
 *   shouldPerformBuild
 *   shouldUploadLogs
 *   buildEmulated
 *   buildOpts: arguments to forward to docker build command
 *
 * @param {any} docker
 * @param {import('../utils/logger')} logger
 * @param {import('../utils/compose-types').ComposeOpts} composeOpts
 * @param {any} opts
 */
const deployProject = function (docker, logger, composeOpts, opts) {
	const _ = require('lodash');
	const doodles = require('resin-doodles');
	const sdk = getBalenaSdk();
	const {
		deployProject: $deployProject,
		loadProject,
	} = require('../utils/compose_ts');

	return Bluebird.resolve(loadProject(logger, composeOpts, opts.image))
		.then(function (project) {
			if (
				project.descriptors.length > 1 &&
				!opts.app.application_type?.[0]?.supports_multicontainer
			) {
				throw new ExpectedError(
					'Target application does not support multiple containers. Aborting!',
				);
			}

			// find which services use images that already exist locally
			return (
				Bluebird.map(project.descriptors, function (d) {
					// unconditionally build (or pull) if explicitly requested
					if (opts.shouldPerformBuild) {
						return d;
					}
					return docker
						.getImage(typeof d.image === 'string' ? d.image : d.image.tag)
						.inspect()
						.return(d.serviceName)
						.catchReturn();
				})
					.filter((d) => !!d)
					.then(function (servicesToSkip) {
						// multibuild takes in a composition and always attempts to
						// build or pull all services. we workaround that here by
						// passing a modified composition.
						const compositionToBuild = _.cloneDeep(project.composition);
						compositionToBuild.services = _.omit(
							compositionToBuild.services,
							servicesToSkip,
						);
						if (_.size(compositionToBuild.services) === 0) {
							logger.logInfo(
								'Everything is up to date (use --build to force a rebuild)',
							);
							return {};
						}
						return compose
							.buildProject(
								docker,
								logger,
								project.path,
								project.name,
								compositionToBuild,
								opts.app.arch,
								opts.app.device_type,
								opts.buildEmulated,
								opts.buildOpts,
								composeOpts.inlineLogs,
								composeOpts.convertEol,
								composeOpts.dockerfilePath,
								composeOpts.nogitignore,
								composeOpts.multiDockerignore,
							)
							.then((builtImages) => _.keyBy(builtImages, 'serviceName'));
					})
					.then((builtImages) =>
						project.descriptors.map(
							(d) =>
								builtImages[d.serviceName] ?? {
									serviceName: d.serviceName,
									name: typeof d.image === 'string' ? d.image : d.image.tag,
									logs: 'Build skipped; image for service already exists.',
									props: {},
								},
						),
					)
					// @ts-ignore slightly different return types of partial vs non-partial release
					.then(function (images) {
						if (opts.app.application_type?.[0]?.is_legacy) {
							const { deployLegacy } = require('../utils/deploy-legacy');

							const msg = getChalk().yellow(
								'Target application requires legacy deploy method.',
							);
							logger.logWarn(msg);

							return Bluebird.join(
								docker,
								logger,
								sdk.auth.getToken(),
								sdk.auth.whoami(),
								sdk.settings.get('balenaUrl'),
								{
									// opts.appName may be prefixed by 'owner/', unlike opts.app.app_name
									appName: opts.appName,
									imageName: images[0].name,
									buildLogs: images[0].logs,
									shouldUploadLogs: opts.shouldUploadLogs,
								},
								deployLegacy,
							).then((releaseId) =>
								// @ts-ignore releaseId should be inferred as a number because that's what deployLegacy is
								// typed as returning but the .js type-checking doesn't manage to infer it correctly due to
								// Promise.join typings
								sdk.models.release.get(releaseId, { $select: ['commit'] }),
							);
						}
						return Bluebird.join(
							sdk.auth.getUserId(),
							sdk.auth.getToken(),
							sdk.settings.get('apiUrl'),
							(userId, auth, apiEndpoint) =>
								$deployProject(
									docker,
									logger,
									project.composition,
									images,
									opts.app.id,
									userId,
									`Bearer ${auth}`,
									apiEndpoint,
									!opts.shouldUploadLogs,
								),
						);
					})
			);
		})
		.then(function (release) {
			logger.outputDeferredMessages();
			logger.logSuccess('Deploy succeeded!');
			logger.logSuccess(`Release: ${release.commit}`);
			console.log();
			console.log(doodles.getDoodle()); // Show charlie
			console.log();
		})
		.tapCatch(() => {
			logger.logError('Deploy failed');
		});
};

export const deploy = {
	signature: 'deploy <appName> [image]',
	description:
		'Deploy a single image or a multicontainer project to a balena application',
	help: `\
Usage: \`deploy <appName> ([image] | --build [--source build-dir])\`

Use this command to deploy an image or a complete multicontainer project to an
application, optionally building it first. The source images are searched for
(and optionally built) using the docker daemon in your development machine or
balena device. (See also the \`balena push\` command for the option of building
the image in the balenaCloud build servers.)

Unless an image is specified, this command will look into the current directory
(or the one specified by --source) for a docker-compose.yml file.  If one is
found, this command will deploy each service defined in the compose file,
building it first if an image for it doesn't exist. If a compose file isn't
found, the command will look for a Dockerfile[.template] file (or alternative
Dockerfile specified with the \`-f\` option), and if yet that isn't found, it
will try to generate one.

To deploy to an app on which you're a collaborator, use
\`balena deploy <appOwnerUsername>/<appName>\`.

When --build is used, all options supported by \`balena build\` are also supported
by this command.

${registrySecretsHelp}

${dockerignoreHelp}

Examples:

	$ balena deploy myApp
	$ balena deploy myApp --build --source myBuildDir/
	$ balena deploy myApp myApp/myImage\
`,
	permission: 'user',
	primary: true,
	options: dockerUtils.appendOptions(
		compose.appendOptions([
			{
				signature: 'source',
				parameter: 'source',
				description:
					'Specify an alternate source directory; default is the working directory',
				alias: 's',
			},
			{
				signature: 'build',
				boolean: true,
				description: 'Force a rebuild before deploy',
				alias: 'b',
			},
			{
				signature: 'nologupload',
				description:
					"Don't upload build logs to the dashboard with image (if building)",
				boolean: true,
			},
		]),
	),
	action(params, options) {
		// compositions with many services trigger misleading warnings
		// @ts-ignore editing property that isn't typed but does exist
		require('events').defaultMaxListeners = 1000;
		const sdk = getBalenaSdk();
		const {
			getRegistrySecrets,
			validateProjectDirectory,
		} = require('../utils/compose_ts');
		const helpers = require('../utils/helpers');
		const Logger = require('../utils/logger');

		const logger = Logger.getLogger();
		logger.logDebug('Parsing input...');

		// when Capitano converts a positional parameter (but not an option)
		// to a number, the original value is preserved with the _raw suffix
		let { appName, appName_raw, image } = params;

		// look into "balena build" options if appName isn't given
		appName = appName_raw || appName || options.application;
		delete options.application;

		return Bluebird.try(function () {
			if (appName == null) {
				throw new ExpectedError(
					'Please specify the name of the application to deploy',
				);
			}

			if (image != null && options.build) {
				throw new ExpectedError(
					'Build option is not applicable when specifying an image',
				);
			}
		})
			.then(function () {
				if (image) {
					return getRegistrySecrets(sdk, options['registry-secrets']).then(
						(registrySecrets) => {
							options['registry-secrets'] = registrySecrets;
						},
					);
				} else {
					return validateProjectDirectory(sdk, {
						dockerfilePath: options.dockerfile,
						noParentCheck: options['noparent-check'] || false,
						projectPath: options.source || '.',
						registrySecretsPath: options['registry-secrets'],
					}).then(function ({ dockerfilePath, registrySecrets }) {
						options.dockerfile = dockerfilePath;
						options['registry-secrets'] = registrySecrets;
					});
				}
			})
			.then(() => helpers.getAppWithArch(appName))
			.then(function (app) {
				return Bluebird.join(
					dockerUtils.getDocker(options),
					dockerUtils.generateBuildOpts(options),
					compose.generateOpts(options),
					(docker, buildOpts, composeOpts) =>
						deployProject(docker, logger, composeOpts, {
							app,
							appName, // may be prefixed by 'owner/', unlike app.app_name
							image,
							shouldPerformBuild: !!options.build,
							shouldUploadLogs: !options.nologupload,
							buildEmulated: !!options.emulated,
							buildOpts,
						}),
				);
			});
	},
};
