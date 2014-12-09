_ = require('lodash')
_.str = require('underscore.string')

# @nodoc
trimString = (string) ->
	return string.trim()

# @nodoc
unwords = (array) ->
	return _.str.join(' ', array...)

# @nodoc
parseWmicDiskDrive = (item) ->
	result = _.str.clean(item)
	result = _.str.words(result)

	caption = _.initial(result)
	caption = unwords(caption)

	id = _.last(result)

	return { caption, id }

# Parse wmic diskdrive get output
#
# @private
#
# @param {String} output wmic diskdrive get DeviceID, Caption output
#
# @return {Object} parsed result containing id and caption
#
# @note This only parses output from `wmic diskdrive get DeviceID, Caption`
#
# @example Parse wmic output
#		result = resin.os.windows.parseWmicDiskDriveGet(output)
#		for item in result
#			console.log("#{item.id} - #{item.caption}")
#
exports.parseWmicDiskDriveGet = (output) ->
	output = _.str.lines(output)
	output = _.map(output, trimString)
	output = _.reject(output, _.isEmpty)
	output = _.tail(output)
	return _.map(output, parseWmicDiskDrive)
