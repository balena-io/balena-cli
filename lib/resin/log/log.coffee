_ = require('lodash')

isQuiet = false

exports.setQuiet = (quiet) ->
	isQuiet = !!quiet

exports.isQuiet = ->
	return isQuiet

# stderr
exports.error = (args...) ->
	console.error.apply(null, args)

exports.warning = (args...) ->
	console.warn.apply(null, args)

# stdout
exports.info = (args...) ->
	return if exports.isQuiet()
	console.info.apply(null, args)

exports.out = (args...) ->
	console.log.apply(null, args)

exports.array = (array, logFunction) ->
	return if not array?

	if not _.isFunction(logFunction)
		throw new Error('Invalid log function')

	if not _.isArray(array)
		return logFunction(array)

	for item in array
		logFunction(item)
