_ = require('lodash')
path = require('path')

# Check is path is absolute
#
# @private
#
# @param {String} path path
# @return {Boolean} is absolute
#
# @example Is path absolute?
#		console.log isAbsolutePath('/usr') # True
#		console.log isAbsolutePath('../Music') # False
#
exports.isAbsolutePath = (p) ->
	return path.resolve(p) is p

# Prefix relative value paths with another path
#
# @private
#
# @param {String} prefix path prefix
# @param {Object} object object containing relative paths as values
#
# @note Absolute values will be omitted
#
# @example Prefix object with path
#		object =
#			dataPrefix: 'resin'
#
#		object = prefixObjectValuesWithPath('/opt', object)
#		console.log(object.dataPrefix) # /opt/resin
#
exports.prefixObjectValuesWithPath = (prefix, object) ->
	return _.object _.map object, (value, key) ->
		result = [ key ]

		if exports.isAbsolutePath(value)
			result.push(value)
		else
			result.push(path.join(prefix, value))

		return result
