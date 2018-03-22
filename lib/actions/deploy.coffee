# Imported here because it's needed for the setup
# of this action
Promise = require('bluebird')
dockerUtils = require('../utils/docker')
compose = require('../utils/compose')

###
Opts must be an object with the following keys:

	app: the application instance to deploy to
	image: the image to deploy; optional
	shouldPerformBuild
	shouldUploadLogs
	buildEmulated
	buildOpts: arguments to forward to docker build command
###
deployProject = (docker, logger, composeOpts, opts) ->
	_ = require('lodash')
	doodles = require('resin-doodles')
	sdk = require('resin-sdk').fromSharedOptions()

	compose.loadProject(
		logger
		composeOpts.projectPath
		composeOpts.projectName
		opts.image
	)
	.then (project) ->
		if project.descriptors.length > 1 and !opts.app.application_type?[0]?.supports_multicontainer
			throw new Error('Target application does not support multiple containers. Aborting!')

		# find which services use images that already exist locally
		Promise.map project.descriptors, (d) ->
			# unconditionally build (or pull) if explicitly requested
			return d if opts.shouldPerformBuild
			docker.getImage(d.image.tag ? d.image).inspect()
			.return(d.serviceName)
			.catchReturn()
		.filter (d) -> !!d
		.then (servicesToSkip) ->
			# multibuild takes in a composition and always attempts to
			# build or pull all services. we workaround that here by
			# passing a modified composition.
			compositionToBuild = _.cloneDeep(project.composition)
			compositionToBuild.services = _.omit(compositionToBuild.services, servicesToSkip)
			if _.size(compositionToBuild.services) is 0
				logger.logInfo('Everything is up to date (use --build to force a rebuild)')
				return {}
			compose.buildProject(
				docker
				logger
				project.path
				project.name
				compositionToBuild
				opts.app.arch
				opts.app.device_type
				opts.buildEmulated
				opts.buildOpts
				composeOpts.inlineLogs
			)
			.then (builtImages) ->
				_.keyBy(builtImages, 'serviceName')
		.then (builtImages) ->
			project.descriptors.map (d) ->
				builtImages[d.serviceName] ? {
					serviceName: d.serviceName,
					name: d.image.tag ? d.image
					logs: 'Build skipped; image for service already exists.'
					props: {}
				}
		.then (images) ->
			if opts.app.application_type?[0]?.is_legacy
				chalk = require('chalk')
				legacyDeploy = require('../utils/deploy-legacy')

				msg = chalk.yellow('Target application requires legacy deploy method.')
				logger.logWarn(msg)

				return Promise.join(
					docker
					logger
					sdk.auth.getToken()
					sdk.auth.whoami()
					sdk.settings.get('resinUrl')
					{
						appName: opts.app.app_name
						imageName: images[0].name
						buildLogs: images[0].logs
						shouldUploadLogs: opts.shouldUploadLogs
					}
					legacyDeploy
				)
				.then (releaseId) ->
					sdk.models.release.get(releaseId, $select: [ 'commit' ])
			Promise.join(
				sdk.auth.getUserId()
				sdk.auth.getToken()
				sdk.settings.get('apiUrl')
				(userId, auth, apiEndpoint) ->
					compose.deployProject(
						docker
						logger
						project.composition
						images
						opts.app.id
						userId
						"Bearer #{auth}"
						apiEndpoint
						!opts.shouldUploadLogs
					)
			)
	.then (release) ->
		logger.logSuccess('Deploy succeeded!')
		logger.logSuccess("Release: #{release.commit}")
		console.log()
		console.log(doodles.getDoodle()) # Show charlie
		console.log()
	.tapCatch (e) ->
		logger.logError('Deploy failed')

module.exports =
	signature: 'deploy <appName> [image]'
	description: 'Deploy a single image or a multicontainer project to a resin.io application'
	help: '''
		Use this command to deploy an image or a complete multicontainer project
		to an application, optionally building it first.

		Usage: `deploy <appName> ([image] | --build [--source build-dir])`

		Unless an image is specified, this command will look into the current directory
		(or the one specified by --source) for a compose file. If one is found, this
		command will deploy each service defined in the compose file, building it first
		if an image for it doesn't exist. If a compose file isn't found, the command
		will look for a Dockerfile, and if yet that isn't found, it will try to
		generate one.

		To deploy to an app on which you're a collaborator, use
		`resin deploy <appOwnerUsername>/<appName>`.

		Note: If building with this command, all options supported by `resin build`
		are also supported with this command.

		Examples:

			$ resin deploy myApp
			$ resin deploy myApp --build --source myBuildDir/
			$ resin deploy myApp myApp/myImage
	'''
	permission: 'user'
	primary: true
	options: dockerUtils.appendOptions compose.appendOptions [
		{
			signature: 'source'
			parameter: 'source'
			description: 'Specify an alternate source directory; default is the working directory'
			alias: 's'
		},
		{
			signature: 'build'
			boolean: true
			description: 'Force a rebuild before deploy'
			alias: 'b'
		},
		{
			signature: 'nologupload'
			description: "Don't upload build logs to the dashboard with image (if building)"
			boolean: true
		}
	]
	action: (params, options, done) ->
		# compositions with many services trigger misleading warnings
		require('events').defaultMaxListeners = 1000

		helpers = require('../utils/helpers')
		Logger = require('../utils/logger')

		logger = new Logger()

		logger.logDebug('Parsing input...')

		Promise.try ->
			{ appName, image } = params

			# look into "resin build" options if appName isn't given
			appName = options.application if not appName?
			delete options.application

			if not appName?
				throw new Error('Please specify the name of the application to deploy')

			if image? and options.build
				throw new Error('Build option is not applicable when specifying an image')

			Promise.join(
				helpers.getApplication(appName)
				helpers.getArchAndDeviceType(appName)
				(app, { arch, device_type }) ->
					app.arch = arch
					app.device_type = device_type
					return app
			)
			.then (app) ->
				[ app, image, !!options.build, !options.nologupload ]

		.then ([ app, image, shouldPerformBuild, shouldUploadLogs ]) ->
			Promise.join(
				dockerUtils.getDocker(options)
				dockerUtils.generateBuildOpts(options)
				compose.generateOpts(options)
				(docker, buildOpts, composeOpts) ->
					deployProject(docker, logger, composeOpts, {
						app
						image
						shouldPerformBuild
						shouldUploadLogs
						buildEmulated: !!options.emulated
						buildOpts
					})
			)
		.asCallback(done)
