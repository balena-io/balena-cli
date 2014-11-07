fs = require('fs')
_ = require('lodash')
async = require('async')

exports.isValidPath = (p) ->
	return _.isString(p)

exports.isFile = (file, outerCallback) ->
	async.waterfall([

		# Check if the file exists
		(callback) ->
			fs.exists file, (exists) ->
				return callback(null, exists)

		# Get file stats
		(exists, callback) ->
			if not exists
				return outerCallback(null, false)

			fs.stat(file, callback)

		# Check if it's a file
		(stats, callback) ->
			return callback(null, !!stats.isFile())

	], outerCallback)
