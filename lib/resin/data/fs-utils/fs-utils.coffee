fs = require('fs')
_ = require('lodash')

# Check if valid path
#
# @private
#
# @param {String} path path
# @return {Boolean} is valid path
#
# @todo There should be more complex checks here
#
# @example Is valid path?
#		console.log isValidPath('/Users/me') # True
#		console.log isValidPath([ 1, 2, 3 ]) # False
#
exports.isValidPath = (p) ->
	return _.isString(p)

# Check if path is directory
#
# @private
#
# @param {String} directory directory
# @param {Function} callback callback(error, isDirectory)
#
# @example Is directory?
#		console.log isDirectory('/usr/local/share') # True
#		console.log isDirectory('/Users/me/app.js') # False
#
exports.isDirectory = (directory, callback) ->
	fs.stat directory, (error, stats) ->
		return callback?(error) if error?
		return callback?(null, stats.isDirectory())
