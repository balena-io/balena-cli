eol = require('os').EOL

module.exports = class Logger
	constructor: ->
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

		@streams =
			build: logger.createLogStream('build'),
			info: logger.createLogStream('info'),
			debug: logger.createLogStream('debug'),
			success: logger.createLogStream('success'),
			warn: logger.createLogStream('warn'),
			error: logger.createLogStream('error')

		_.mapKeys @streams, (stream, key) ->
			if key isnt 'debug'
				stream.pipe(process.stdout)
			else
				stream.pipe(process.stdout) if process.env.DEBUG?

		@formatMessage = logger.formatWithPrefix.bind(logger)

	logInfo: (msg) ->
		@streams.info.write(msg + eol)

	logDebug: (msg) ->
		@streams.debug.write(msg + eol)

	logSuccess: (msg) ->
		@streams.success.write(msg + eol)

	logWarn: (msg) ->
		@streams.warn.write(msg + eol)

	logError: (msg) ->
		@streams.error.write(msg + eol)
