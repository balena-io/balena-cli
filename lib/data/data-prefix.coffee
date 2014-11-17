fsUtils = require('../fs-utils/fs-utils')

prefix = null

exports.get = ->
	return prefix

exports.set = (newPrefix, callback) ->
	if not fsUtils.isValidPath(newPrefix)
		return callback?(new Error('Invalid path'))

	prefix = newPrefix
	return callback?(null, prefix)

exports.clear = ->
	prefix = null
