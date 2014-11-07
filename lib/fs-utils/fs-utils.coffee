fs = require('fs')
_ = require('lodash')
async = require('async')

exports.isValidPath = (p) ->
	return _.isString(p)

exports.isFile = (file, callback) ->
	async.waterfall([

		# Check if the file exists
		(callback) ->
			fs.exists file, (exists) ->
				if not exists

					# Return false anyway to avoid confusions
					return callback(new Error('File doesn\'t exists'), false)

				return callback(null, exists)

		# Get file stats
		(exists, callback) ->
			fs.stat(file, callback)

		# Check if it's a file
		(stats, callback) ->
			return callback(null, !!stats.isFile())

	], callback)
