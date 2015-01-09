_ = require('lodash')
log = require('../log/log')

exports.handle = (error, exit = true) ->
	return if not error? or error not instanceof Error

	if process.env.DEBUG
		log.error(error.stack)
	else
		if error.code is 'EISDIR'
			log.error("File is a directory: #{error.path}")

		else if error.code is 'ENOENT'
			log.error("No such file or directory: #{error.path}")

		else if error.message?
			log.error(error.message)

	if _.isNumber(error.exitCode)
		errorCode = error.exitCode
	else
		errorCode = 1

	process.exit(errorCode) if exit

exports.handleCallback = (callback, context, exit) ->
	if not _.isFunction(callback)
		throw new Error('Callback is not a function')

	return (error, args...) ->
		exports.handle(error, exit) if error?
		return callback.apply(context, args)
