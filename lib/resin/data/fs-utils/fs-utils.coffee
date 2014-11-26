fs = require('fs')
_ = require('lodash')

# TODO: There should be more complex checks here
exports.isValidPath = (p) ->
	return _.isString(p)

exports.isDirectory = (directory, callback) ->
	fs.stat directory, (error, stats) ->
		return callback?(error) if error?
		return callback?(null, stats.isDirectory())
