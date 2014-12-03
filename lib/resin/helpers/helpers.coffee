_ = require('lodash')
path = require('path')

exports.isAbsolutePath = (p) ->
	return path.resolve(p) is p

exports.prefixObjectValuesWithPath = (prefix, object) ->
	return _.object _.map object, (value, key) ->
		result = [ key ]

		if exports.isAbsolutePath(value)
			result.push(value)
		else
			result.push(path.join(prefix, value))

		return result
