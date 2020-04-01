###*
# @license
# Copyright 2016-2020 Balena Ltd.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
###

# Imported here because it's needed for the setup
# of this action
Promise = require('bluebird')
dockerUtils = require('../utils/docker')
compose = require('../utils/compose')
{ registrySecretsHelp } = require('../utils/messages')
{ getBalenaSdk } = require('../utils/lazy')

###
Opts must be an object with the following keys:

	app: the app this build is for (optional)
	arch: the architecture to build for
	deviceType: the device type to build for
	buildEmulated
	buildOpts: arguments to forward to docker build command
###
buildProject = (docker, logger, composeOpts, opts) ->
	{ loadProject } = require('../utils/compose_ts')
	Promise.resolve(loadProject(logger, composeOpts))
	.then (project) ->
		appType = opts.app?.application_type?[0]
		if appType? and project.descriptors.length > 1 and not appType.supports_multicontainer
			logger.logWarn(
				'Target application does not support multiple containers.\n' +
				'Continuing with build, but you will not be able to deploy.'
			)

		compose.buildProject(
			docker
			logger
			project.path
			project.name
			project.composition
			opts.arch
			opts.deviceType
			opts.buildEmulated
			opts.buildOpts
			composeOpts.inlineLogs
			opts.convertEol
			composeOpts.dockerfilePath
		)
	.then ->
		logger.outputDeferredMessages()
		logger.logSuccess('Build succeeded!')
	.tapCatch (e) ->
		logger.logError('Build failed')

module.exports =
	signature: 'build [source]'
	description: 'Build a single image or a multicontainer project locally'
	primary: true
	help: """
		Use this command to build an image or a complete multicontainer project with
		the provided docker daemon in your development machine or balena device.
		(See also the `balena push` command for the option of building images in the
		balenaCloud build servers.)

		You must provide either an application or a device-type/architecture pair to use
		the balena Dockerfile pre-processor (e.g. Dockerfile.template -> Dockerfile).

		This command will look into the given source directory (or the current working
		directory if one isn't specified) for a docker-compose.yml file, and if found,
		each service defined in the compose file will be built. If a compose file isn't
		found, it will look for a Dockerfile[.template] file (or alternative Dockerfile
		specified with the `--dockerfile` option), and if no dockerfile is found, it
		will try to generate one.

		#{registrySecretsHelp}

		Examples:

			$ balena build
			$ balena build ./source/
			$ balena build --deviceType raspberrypi3 --arch armv7hf --emulated
			$ balena build --application MyApp ./source/
			$ balena build --docker /var/run/docker.sock   # Linux, Mac
			$ balena build --docker //./pipe/docker_engine # Windows
			$ balena build --dockerHost my.docker.host --dockerPort 2376 --ca ca.pem --key key.pem --cert cert.pem
	"""
	options: dockerUtils.appendOptions compose.appendOptions [
		{
			signature: 'arch'
			parameter: 'arch'
			description: 'The architecture to build for'
			alias: 'A'
		},
		{
			signature: 'deviceType'
			parameter: 'deviceType'
			description: 'The type of device this build is for'
			alias: 'd'
		},
		{
			signature: 'application'
			parameter: 'application'
			description: 'The target balena application this build is for'
			alias: 'a'
		},
	]
	action: (params, options) ->
		# compositions with many services trigger misleading warnings
		require('events').defaultMaxListeners = 1000

		sdk = getBalenaSdk()
		{ ExpectedError } = require('../errors')
		{ checkLoggedIn } = require('../utils/patterns')
		{ validateProjectDirectory } = require('../utils/compose_ts')
		helpers = require('../utils/helpers')
		Logger = require('../utils/logger')

		logger = Logger.getLogger()
		logger.logDebug('Parsing input...')

		# `build` accepts `[source]` as a parameter, but compose expects it
		# as an option. swap them here
		options.source ?= params.source
		delete params.source

		options.convertEol = options['convert-eol'] || false
		delete options['convert-eol']

		{ application, arch, deviceType } = options

		Promise.try ->
			if (not (arch? and deviceType?) and not application?) or (application? and (arch? or deviceType?))
				throw new ExpectedError('You must specify either an application or an arch/deviceType pair to build for')
			if (application)
				checkLoggedIn()
		.then ->
			validateProjectDirectory(sdk, {
				dockerfilePath: options.dockerfile,
				noParentCheck: options['noparent-check'] || false,
				projectPath: options.source || '.',
				registrySecretsPath: options['registry-secrets'],
			})
		.then ({ dockerfilePath, registrySecrets }) ->
			options.dockerfile = dockerfilePath
			options['registry-secrets'] = registrySecrets

			if arch? and deviceType?
				[ undefined, arch, deviceType ]
			else
				Promise.join(
					helpers.getApplication(application)
					helpers.getArchAndDeviceType(application)
					(app, { arch, device_type }) ->
						app.arch = arch
						app.device_type = device_type
						return app
				)
				.then (app) ->
					[ app, app.arch, app.device_type ]

		.then ([ app, arch, deviceType ]) ->
			Promise.join(
				dockerUtils.getDocker(options)
				dockerUtils.generateBuildOpts(options)
				compose.generateOpts(options)
				(docker, buildOpts, composeOpts) ->
					buildProject(docker, logger, composeOpts, {
						app
						arch
						deviceType
						buildEmulated: !!options.emulated
						buildOpts
						convertEol: options.convertEol
					})
			)
