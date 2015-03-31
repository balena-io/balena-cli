npm = require('npm')
async = require('async')
_ = require('lodash-contrib')

exports.getLatestVersion = (name, callback) ->
	async.waterfall([

		(callback) ->
			options =

				# TODO: There is no way to quiet npm install completely.
				# Some output is still shown once the module is updated
				# https://github.com/npm/npm/issues/2040
				loglevel: 'silent'
				global: true

			npm.load(options, _.unary(callback))

		(callback) ->
			npm.commands.view [ name ], true, (error, data) ->
				versions = _.keys(data)
				return callback(error, _.first(versions))

	], callback)

exports.isUpdated = (name, currentVersion, callback) ->
	exports.getLatestVersion name, (error, latestVersion) ->
		return callback(error) if error?
		return callback(null, currentVersion is latestVersion)
