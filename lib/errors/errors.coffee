TypedError = require('typed-error')
log = require('../log/log')

exports.NotFound = class NotFound extends TypedError
	contructor: (name) ->
		@message = "Couldn't find #{name}"

exports.handle = (error, exit = true) ->
	return if not error? or error not instanceof Error

	if error.message?
		log.error(error.message)

	process.exit(1) if exit
