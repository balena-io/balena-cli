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
