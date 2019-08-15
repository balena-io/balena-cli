# Imported here because it's needed for the setup
# of this action
Promise = require('bluebird')
dockerUtils = require('../utils/docker')
compose = require('../utils/compose')
{ registrySecretsHelp } = require('../utils/messages')

###
Opts must be an object with the following keys:

	app: the application instance to deploy to
	image: the image to deploy; optional
	dockerfilePath: name of an alternative Dockerfile; optional
	shouldPerformBuild
	shouldUploadLogs
	buildEmulated
	buildOpts: arguments to forward to docker build command
###
deployProject = (docker, logger, composeOpts, opts) ->
	_ = require('lodash')
	doodles = require('resin-doodles')
	sdk = require('balena-sdk').fromSharedOptions()

	compose.loadProject(
		logger
		composeOpts.projectPath
		composeOpts.projectName
		opts.image
		composeOpts.dockerfilePath  # ok if undefined
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
					sdk.settings.get('balenaUrl')
					{
						# opts.appName may be prefixed by 'owner/', unlike opts.app.app_name
						appName: opts.appName
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
	description: 'Deploy a single image or a multicontainer project to a balena application'
	help: """
		Usage: `deploy <appName> ([image] | --build [--source build-dir])`

		Use this command to deploy an image or a complete multicontainer project to an
		application, optionally building it first. The source images are searched for
		(and optionally built) using the docker daemon in your development machine or
		balena device. (See also the `balena push` command for the option of building
		the image in the balenaCloud build servers.)

		Unless an image is specified, this command will look into the current directory
		(or the one specified by --source) for a docker-compose.yml file.  If one is
		found, this command will deploy each service defined in the compose file,
		building it first if an image for it doesn't exist. If a compose file isn't
		found, the command will look for a Dockerfile[.template] file (or alternative
		Dockerfile specified with the `-f` option), and if yet that isn't found, it
		will try to generate one.

		To deploy to an app on which you're a collaborator, use
		`balena deploy <appOwnerUsername>/<appName>`.

		When --build is used, all options supported by `balena build` are also supported
		by this command.

		#{registrySecretsHelp}

		Examples:

			$ balena deploy myApp
			$ balena deploy myApp --build --source myBuildDir/
			$ balena deploy myApp myApp/myImage
	"""
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
		sdk = (require('balena-sdk')).fromSharedOptions()
		{ validateComposeOptions } = require('../utils/compose_ts')
		helpers = require('../utils/helpers')
		Logger = require('../utils/logger')

		logger = new Logger()
		logger.logDebug('Parsing input...')

		# when Capitano converts a positional parameter (but not an option)
		# to a number, the original value is preserved with the _raw suffix
		{ appName, appName_raw, image } = params

		# look into "balena build" options if appName isn't given
		appName = appName_raw || appName || options.application
		delete options.application

		Promise.resolve(validateComposeOptions(sdk, options))
		.then ->
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
						appName  # may be prefixed by 'owner/', unlike app.app_name
						image
						shouldPerformBuild
						shouldUploadLogs
						buildEmulated: !!options.emulated
						buildOpts
					})
			)
		.asCallback(done)
