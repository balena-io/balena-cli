_ = require('lodash')
log = require('../log/log')

exports.handle = (error, exit = true) ->
	return if not error? or error not instanceof Error

	if process.env.DEBUG
		log.error(error.stack)
	else
		if error.message?
			log.error(error.message)

	if _.isNumber(error.code)
		errorCode = error.code
	else
		errorCode = 1

	process.exit(errorCode) if exit
