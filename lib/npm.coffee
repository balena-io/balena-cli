npm = require('npm')
async = require('async')
_ = require('lodash-contrib')

exports.update = (name, callback) ->
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
			npm.commands.update [ name ], (error, data) ->
				return callback(error, data)

		(data, callback) ->
			if _.isEmpty(data)
				error = new Error('You are already running the latest version')
				return callback(error)

			newVersion = _.last(_.first(_.last(data)).split('@'))
			return callback(null, newVersion)

	], callback)

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
