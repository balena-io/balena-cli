Promise = require('bluebird')

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

bufferImage = (docker, imageId, bufferFile) ->
	Promise = require('bluebird')
	streamUtils = require('./streams')

	image = docker.getImage(imageId)
	imageMetadata = image.inspect()

	Promise.join image.get(), imageMetadata.get('Size'), (imageStream, imageSize) ->
		streamUtils.buffer(imageStream, bufferFile)
		.tap (bufferedStream) ->
			bufferedStream.length = imageSize

getSpinner = (message) ->
	visuals = require('resin-cli-visuals')
	return new visuals.Spinner(message)

showPushProgress = (message) ->
	visuals = require('resin-cli-visuals')
	progressBar = new visuals.Progress(message)
	progressBar.update({ percentage: 0 })
	return progressBar

forwardStatusMessageFromRemote = (logger, msg) ->
	msg.split(/\r\n|\n/).forEach (line) ->
		if /^Warning: This endpoint is deprecated/.test(line)
			return
		logger.logInfo(line)

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
					when 'status' then forwardStatusMessageFromRemote(logger, obj.message)
					else reject(new Error("Received unexpected reply from remote: #{data}"))
			else
				reject(new Error("Received unexpected reply from remote: #{data}"))

		uploadRequest
		.on('error', reject)
		.on('data', handleMessage)

uploadImage = (imageStream, token, username, url, appName, logger) ->
	request = require('request')
	progressStream = require('progress-stream')
	zlib = require('zlib')

	# Need to strip off the newline
	progressMessage = logger.formatMessage('info', 'Uploading').slice(0, -1)
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

###
opts must be a hash with the following keys:

- appName: the name of the app to deploy to
- imageName: the name of the image to deploy
- buildLogs: a string with build output
- shouldUploadLogs
###
module.exports = (docker, logger, token, username, url, opts) ->
	_ = require('lodash')
	tmp = require('tmp')
	tmpNameAsync = Promise.promisify(tmp.tmpName)

	# Ensure the tmp files gets deleted
	tmp.setGracefulCleanup()

	{ appName, imageName, buildLogs, shouldUploadLogs } = opts
	logs = buildLogs

	tmpNameAsync()
	.then (bufferFile) ->
		logger.logInfo('Initializing deploy...')
		bufferImage(docker, imageName, bufferFile)
		.then (stream) ->
			uploadImage(stream, token, username, url, appName, logger)
		.finally ->
			# If the file was never written to (for instance because an error
			# has occured before any data was written) this call will throw an
			# ugly error, just suppress it
			Promise.try ->
				require('mz/fs').unlink(bufferFile)
			.catchReturn()
	.tap ({ buildId }) ->
		return if not shouldUploadLogs

		logger.logInfo('Uploading logs...')
		Promise.join(
			logs
			token
			url
			buildId
			username
			appName
			uploadLogs
		)
	.get('buildId')
