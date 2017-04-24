Promise = require('bluebird')
dockerUtils = require('../utils/docker')

getBuilderPushEndpoint = (baseUrl, owner, app) ->
	escOwner = encodeURIComponent(owner)
	escApp = encodeURIComponent(app)
	"https://builder.#{baseUrl}/v1/push?owner=#{escOwner}&app=#{escApp}"

formatImageName = (image) ->
	image.split('/').pop()

parseInput = Promise.method (params, options) ->
	if not params.appName?
		throw new Error('Need an application to deploy to!')
	appName = params.appName
	image = undefined
	if params.image?
		if options.build or options.source?
			throw new Error('Build and source parameters are not applicable when specifying an image')
		options.build = false
		image = params.image
	else if options.build
		source = options.source || '.'
	else
		throw new Error('Need either an image or a build flag!')

	return [appName, options.build, source, image]

pushProgress = (imageSize, request, logStreams, timeout = 250) ->
	logging = require('../utils/logging')
	ansiEscapes = require('ansi-escapes')

	logging.logInfo(logStreams, 'Initialising...')
	progressReporter = setInterval ->
		sent = request.req.connection._bytesDispatched
		percent = (sent / imageSize) * 100
		if percent >= 100
			clearInterval(progressReporter)
			percent = 100
		process.stdout.write(ansiEscapes.cursorUp(1))
		process.stdout.clearLine()
		process.stdout.cursorTo(0)
		logging.logInfo(logStreams, "Uploaded #{percent.toFixed(1)}%")
	, timeout

getBundleInfo = (options) ->
	helpers = require('../utils/helpers')

	helpers.getAppInfo(options.appName)
	.then (app) ->
		[app.arch, app.device_type]

performUpload = (image, token, username, url, size, appName, logStreams) ->
	request = require('request')
	url = url || process.env.RESINRC_RESIN_URL
	post = request.post
		url: getBuilderPushEndpoint(url, username, appName)
		auth:
			bearer: token
		body: image

	uploadToPromise(post, size, logStreams)

uploadToPromise = (request, size, logStreams) ->
	logging = require('../utils/logging')
	new Promise (resolve, reject) ->

		handleMessage = (data) ->
			data = data.toString()
			logging.logDebug(logStreams, "Received data: #{data}")

			obj = JSON.parse(data)
			if obj.type?
				switch obj.type
					when 'error' then reject(new Error("Remote error: #{obj.error}"))
					when 'success' then resolve(obj.image)
					when 'status' then logging.logInfo(logStreams, "Remote: #{obj.message}")
					else reject(new Error("Received unexpected reply from remote: #{data}"))
			else
				reject(new Error("Received unexpected reply from remote: #{data}"))

		request
		.on('error', reject)
		.on('data', handleMessage)

		# Set up upload reporting
		pushProgress(size, request, logStreams)


module.exports =
	signature: 'deploy <appName> [image]'
	description: 'Deploy a container to a resin.io application'
	help: '''
		Use this command to deploy and optionally build an image to an application.

		Usage: deploy <appName> ([image] | --build [--source build-dir])

		Note: If building with this command, all options supported by `resin build`
		are also support with this command.

		Examples:
		$ resin deploy myApp --build --source myBuildDir/
		$ resin deploy myApp myApp/myImage
	'''
	permission: 'user'
	options: dockerUtils.appendOptions [
		{
			signature: 'build'
			boolean: true
			description: 'Build image then deploy'
			alias: 'b'
		},
		{
			signature: 'source'
			parameter: 'source'
			description: 'The source directory to use when building the image'
			alias: 's'
		}
	]
	action: (params, options, done) ->
		_ = require('lodash')
		tmp = require('tmp')
		tmpNameAsync = Promise.promisify(tmp.tmpName)
		resin = require('resin-sdk-preconfigured')

		logging = require('../utils/logging')

		logStreams = logging.getLogStreams()

		# Ensure the tmp files gets deleted
		tmp.setGracefulCleanup()

		docker = dockerUtils.getDocker(options)
		# Check input parameters
		parseInput(params, options)
		.then ([appName, build, source, imageName]) ->
			tmpNameAsync()
			.then (tmpPath) ->

				# Setup the build args for how the build routine expects them
				options = _.assign({}, options, { appName })
				params = _.assign({}, params, { source })

				Promise.try ->
					if build
						dockerUtils.runBuild(params, options, getBundleInfo, logStreams)
					else
						imageName
				.then (imageName) ->
					Promise.join(
						dockerUtils.bufferImage(docker, imageName, tmpPath)
						resin.auth.getToken()
						resin.auth.whoami()
						resin.settings.get('resinUrl')
						dockerUtils.getImageSize(docker, imageName)
						params.appName
						logStreams
						performUpload
					)
				.finally ->
					require('fs').unlink(tmpPath)
		.then (imageName) ->
			logging.logSuccess(logStreams, "Successfully deployed image: #{formatImageName(imageName)}")
		.asCallback(done)
