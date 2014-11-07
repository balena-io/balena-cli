fsUtils = require('../fs-utils/fs-utils')

prefix = null

exports.get = ->
	return prefix

exports.set = (newPrefix) ->
	if not fsUtils.isValidPath(newPrefix)
		throw new Error('Invalid path')

	prefix = newPrefix

exports.clear = ->
	prefix = null
