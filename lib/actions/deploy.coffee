Promise = require('bluebird')
dockerUtils = require('../utils/docker')

getBuilderPushEndpoint = (baseUrl, owner, app) ->
	querystring = require('querystring')
	args = querystring.stringify({ owner, app })
	"https://builder.#{baseUrl}/v1/push?#{args}"

getBuilderLogPushEndpoint = (baseUrl, buildId, owner, app) ->
	querystring = require('querystring')
	args = querystring.stringify({ owner, app, buildId })
	"https://builder.#{baseUrl}/v1/pushLogs?#{args}"

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

showPushProgress = (message) ->
	visuals = require('resin-cli-visuals')
	progressBar = new visuals.Progress(message)
	progressBar.update({ percentage: 0 })
	return progressBar

getBundleInfo = (options) ->
	helpers = require('../utils/helpers')

	helpers.getArchAndDeviceType(options.appName)
	.then (app) ->
		[app.arch, app.device_type]

performUpload = (imageStream, token, username, url, appName, logger) ->
	request = require('request')
	progressStream = require('progress-stream')
	zlib = require('zlib')

	# Need to strip off the newline
	progressMessage = logger.formatMessage('info', 'Deploying').slice(0, -1)
	progressBar = showPushProgress(progressMessage)
	streamWithProgress = imageStream.pipe progressStream
		time: 500,
		length: imageStream.length
	, ({ percentage, eta }) ->
		progressBar.update
			percentage: Math.min(percentage, 100)
			eta: eta

	uploadRequest = request.post
		url: getBuilderPushEndpoint(url, username, appName)
		headers:
			'Content-Encoding': 'gzip'
		auth:
			bearer: token
		body: streamWithProgress.pipe(zlib.createGzip({
			level: 6
		}))

	uploadToPromise(uploadRequest, logger)

uploadLogs = (logs, token, url, buildId, username, appName) ->
	request = require('request')
	request.post
		json: true
		url: getBuilderLogPushEndpoint(url, buildId, username, appName)
		auth:
			bearer: token
		body: Buffer.from(logs)

uploadToPromise = (uploadRequest, logger) ->
	new Promise (resolve, reject) ->

		handleMessage = (data) ->
			data = data.toString()
			logger.logDebug("Received data: #{data}")

			try
				obj = JSON.parse(data)
			catch e
				logger.logError('Error parsing reply from remote side')
				reject(e)
				return

			if obj.type?
				switch obj.type
					when 'error' then reject(new Error("Remote error: #{obj.error}"))
					when 'success' then resolve(obj)
					when 'status' then logger.logInfo("Remote: #{obj.message}")
					else reject(new Error("Received unexpected reply from remote: #{data}"))
			else
				reject(new Error("Received unexpected reply from remote: #{data}"))

		uploadRequest
		.on('error', reject)
		.on('data', handleMessage)

module.exports =
	signature: 'deploy <appName> [image]'
	description: 'Deploy an image to a resin.io application'
	help: '''
		Use this command to deploy an image to an application, optionally building it first.

		Usage: `deploy <appName> ([image] | --build [--source build-dir])`

		To deploy to an app on which you're a collaborator, use
		`resin deploy <appOwnerUsername>/<appName>`.

		Note: If building with this command, all options supported by `resin build`
		are also supported with this command.

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
		},
		{
			signature: 'nologupload'
			description: "Don't upload build logs to the dashboard with image (if building)"
			boolean: true
		}
	]
	action: (params, options, done) ->
		_ = require('lodash')
		tmp = require('tmp')
		tmpNameAsync = Promise.promisify(tmp.tmpName)
		resin = require('resin-sdk-preconfigured')

		Logger = require('../utils/logger')
		logger = new Logger()

		# Ensure the tmp files gets deleted
		tmp.setGracefulCleanup()

		logs = ''

		upload = (token, username, url) ->
			dockerUtils.getDocker(options)
			.then (docker) ->
				# Check input parameters
				parseInput(params, options)
				.then ([appName, build, source, imageName]) ->
					tmpNameAsync()
					.then (bufferFile) ->

						# Setup the build args for how the build routine expects them
						options = _.assign({}, options, { appName })
						params = _.assign({}, params, { source })

						Promise.try ->
							if build
								dockerUtils.runBuild(params, options, getBundleInfo, logger)
							else
								{ image: imageName, log: '' }
						.then ({ image: imageName, log: buildLogs }) ->
							logger.logInfo('Initializing deploy...')

							logs = buildLogs
							Promise.all [
								dockerUtils.bufferImage(docker, imageName, bufferFile)
								token
								username
								url
								params.appName
								logger
							]
							.spread(performUpload)
						.finally ->
							# If the file was never written to (for instance because an error
							# has occured before any data was written) this call will throw an
							# ugly error, just suppress it
							Promise.try ->
								require('mz/fs').unlink(bufferFile)
							.catch(_.noop)
				.tap ({ image: imageName, buildId }) ->
					logger.logSuccess("Successfully deployed image: #{formatImageName(imageName)}")
					return buildId
				.then ({ image: imageName, buildId }) ->
					if logs is '' or options.nologupload?
						return ''

					logger.logInfo('Uploading logs to dashboard...')

					Promise.join(
						logs
						token
						url
						buildId
						username
						params.appName
						uploadLogs
					)
					.return('Successfully uploaded logs')
				.then (msg) ->
					logger.logSuccess(msg) if msg isnt ''
				.asCallback(done)

		Promise.join(
			resin.auth.getToken()
			resin.auth.whoami()
			resin.settings.get('resinUrl')
			upload
		)
