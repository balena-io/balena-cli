mkdirp = require('mkdirp')
fsUtils = require('./fs-utils/fs-utils')

prefix = null

exports.get = ->
	return prefix

exports.set = (newPrefix, callback) ->
	if not fsUtils.isValidPath(newPrefix)
		return callback?(new Error('Invalid path'))

	mkdirp newPrefix, (error) ->
		return callback?(error) if error?
		prefix = newPrefix
		return callback?()

exports.clear = ->
	prefix = null
