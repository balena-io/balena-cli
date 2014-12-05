_ = require('lodash')

# @nodoc
isQuiet = false

# Change log quietness
#
# @param {Boolean} quiet quietness
#
# @note If quiet is true, only resin.log.info will be quieted
#
# @example Set quietness
#		resin.log.setQuiet(true)
#
exports.setQuiet = (quiet) ->
	isQuiet = !!quiet

# Check quietness
#
# @return {Boolean} is quiet
#
# @example Check quietness
#		resin.log.isQuiet()
#
exports.isQuiet = ->
	return isQuiet

# Log an error
#
# @param {...String} message message
#
# @example Log an error
#		resin.log.error('Something went wrong!')
#
exports.error = (args...) ->
	console.error.apply(null, args)

# Log a warning
#
# @param {...String} message message
#
# @example Log a warning
#		resin.log.warning('Something might happened!')
#
exports.warning = (args...) ->
	console.warn.apply(null, args)

# Log info
#
# @param {...String} message message
#
# @example Log info
#		resin.log.info('Look!')
#
exports.info = (args...) ->
	return if exports.isQuiet()
	console.info.apply(null, args)

# Log out
#
# @param {...String} message message
#
# @note This will not be quieted even if setQuiet is set to true
#
# @example Log out
#		resin.log.out('Hello World!')
#
exports.out = (args...) ->
	console.log.apply(null, args)

# Log an array
#
# It will iterate trough the array, calling logFunction for every item
#
# @param {Array} array array
# @param {Function} logFunction log function (e.g: resin.log.info)
#
# @throw Will throw if logFunction is not a function
#
exports.array = (array, logFunction) ->
	return if not array?

	if not _.isFunction(logFunction)
		throw new Error('Invalid log function')

	if not _.isArray(array)
		return logFunction(array)

	for item in array
		logFunction(item)
