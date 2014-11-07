fs = require('fs')
path = require('path')
fsUtils = require('../fs-utils/fs-utils')
exports.prefix = require('./data-prefix')

haltIfNoPrefix = (callback) ->
	return ->
		if not exports.prefix.get()?
			throw new Error('Did you forget to set a prefix?')
		return callback.apply(null, arguments)

constructPath = (key) ->
	prefix = exports.prefix.get()
	result = path.join(prefix, key)

	if not fsUtils.isValidPath(result)
		throw new Error('Invalid path')

	return result

exports.get = haltIfNoPrefix (key, options, callback) ->
	keyPath = constructPath(key)
	fs.readFile(keyPath, options, callback)

exports.set = haltIfNoPrefix (key, value, options, callback) ->
	keyPath = constructPath(key)
	fs.writeFile(keyPath, value, options, callback)
