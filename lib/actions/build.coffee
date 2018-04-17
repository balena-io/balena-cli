# Imported here because it's needed for the setup
# of this action
Promise = require('bluebird')
dockerUtils = require('../utils/docker')
compose = require('../utils/compose')

###
Opts must be an object with the following keys:

	app: the app this build is for (optional)
	arch: the architecture to build for
	deviceType: the device type to build for
	buildEmulated
	buildOpts: arguments to forward to docker build command
###
buildProject = (docker, logger, composeOpts, opts) ->
	compose.loadProject(
		logger
		composeOpts.projectPath
		composeOpts.projectName
	)
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
		)
	.then ->
		logger.logSuccess('Build succeeded!')
	.tapCatch (e) ->
		logger.logError('Build failed')

module.exports =
	signature: 'build [source]'
	description: 'Build a single image or a multicontainer project locally'
	primary: true
	help: '''
		Use this command to build an image or a complete multicontainer project
		with the provided docker daemon.

		You must provide either an application or a device-type/architecture
		pair to use the resin Dockerfile pre-processor
		(e.g. Dockerfile.template -> Dockerfile).

		This command will look into the given source directory (or the current working
		directory if one isn't specified) for a compose file. If one is found, this
		command will build each service defined in the compose file. If a compose file
		isn't found, the command will look for a Dockerfile, and if yet that isn't found,
		it will try to generate one.

		Examples:

			$ resin build
			$ resin build ./source/
			$ resin build --deviceType raspberrypi3 --arch armhf
			$ resin build --application MyApp ./source/
			$ resin build --docker '/var/run/docker.sock'
			$ resin build --dockerHost my.docker.host --dockerPort 2376 --ca ca.pem --key key.pem --cert cert.pem
	'''
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
			description: 'The target resin.io application this build is for'
			alias: 'a'
		},
	]
	action: (params, options, done) ->
		# compositions with many services trigger misleading warnings
		require('events').defaultMaxListeners = 1000

		{ exitWithExpectedError } = require('../utils/patterns')
		helpers = require('../utils/helpers')
		Logger = require('../utils/logger')

		logger = new Logger()

		logger.logDebug('Parsing input...')

		Promise.try ->
			# `build` accepts `[source]` as a parameter, but compose expects it
			# as an option. swap them here
			options.source ?= params.source
			delete params.source

			{ application, arch, deviceType } = options

			if (not (arch? and deviceType?) and not application?) or (application? and (arch? or deviceType?))
				exitWithExpectedError('You must specify either an application or an arch/deviceType pair to build for')

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
					})
			)
		.asCallback(done)
