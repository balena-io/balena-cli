async = require('async')
_ = require('lodash-contrib')
npm = require('npm')
packageJSON = require('../../package.json')

exports.update =
	signature: 'update'
	description: 'update the resin cli'
	help: '''
		Use this command to update the Resin CLI

		This command outputs information about the update process.
		Use `--quiet` to remove that output.

		Examples:

			$ resin update
	'''
	action: (params, options, done) ->
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
				npm.commands.update [ packageJSON.name ], (error, data) ->
					return callback(error, data)

			(data, callback) ->
				if _.isEmpty(data)
					return callback(new Error('You are already running the latest version'))

				newVersion = _.last(_.first(_.last(data)).split('@'))
				console.info("Upgraded #{packageJSON.name} to v#{newVersion}.")

				return callback()

		], done)
