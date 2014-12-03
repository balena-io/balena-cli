_ = require('lodash')
TypedError = require('typed-error')
log = require('../log/log')

exports.NotFound = class NotFound extends TypedError
	constructor: (name) ->
		@message = "Couldn't find #{name}"
		@code = 1

exports.InvalidConfigFile = class NotFound extends TypedError
	constructor: (file) ->
		@message = "Invalid configuration file: #{file}"
		@code = 1

exports.InvalidCredentials = class InvalidCredentials extends TypedError
	constructor: ->
		@message = 'Invalid credentials'
		@code = 1

exports.NotAny = class NotAny extends TypedError
	constructor: (name) ->
		@message = "You don't have any #{name}"
		@code = 0

exports.handle = (error, exit = true) ->
	return if not error? or error not instanceof Error

	if error.message?
		log.error(error.message)

	if _.isNumber(error.code)
		errorCode = error.code
	else
		errorCode = 1

	process.exit(errorCode) if exit
