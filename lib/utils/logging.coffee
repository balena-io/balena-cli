eol = require('os').EOL

exports.getLogStreams = ->
	{ StreamLogger } = require('resin-stream-logger')
	colors = require('colors')
	_ = require('lodash')

	logger = new StreamLogger()
	logger.addPrefix('build', colors.blue('[Build]'))
	logger.addPrefix('info', colors.cyan('[Info]'))
	logger.addPrefix('debug', colors.magenta('[Debug]'))
	logger.addPrefix('success', colors.green('[Success]'))
	logger.addPrefix('warn', colors.yellow('[Warn]'))
	logger.addPrefix('error', colors.red('[Error]'))

	streams =
		build: logger.createLogStream('build'),
		info: logger.createLogStream('info'),
		debug: logger.createLogStream('debug'),
		success: logger.createLogStream('success'),
		warn: logger.createLogStream('warn'),
		error: logger.createLogStream('error')

	_.mapKeys streams, (stream, key) ->
		if key isnt 'debug'
			stream.pipe(process.stdout)
		else
			stream.pipe(process.stdout) if process.env.DEBUG?

	streams

exports.logInfo = (logStreams, msg) ->
	logStreams.info.write(msg + eol)

exports.logDebug = (logStreams, msg) ->
	logStreams.debug.write(msg + eol)

exports.logSuccess = (logStreams, msg) ->
	logStreams.success.write(msg + eol)

exports.logWarn = (logStreams, msg) ->
	logStreams.warn.write(msg + eol)

exports.logError = (logStreams, msg) ->
	logStreams.error.write(msg + eol)
