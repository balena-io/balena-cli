_ = require('lodash')
_.str = require('underscore.string')
async = require('async')
npm = require('npm')
visuals = require('resin-cli-visuals')

exports.list =
	signature: 'plugins'
	description: 'list all plugins'
	help: '''
		Use this command to list all the installed resin plugins.

		Examples:
			$ resin plugins
	'''
	permission: 'user'
	action: (params, options, done) ->
		async.waterfall([

			(callback) ->
				npm.load

					# TODO: Maybe we should check the local modules as well?
					global: true

					depth: 0
					parseable: true
				, callback

			(data, callback) ->
				npm.commands.list([], true, callback)

			(data, lite, callback) ->
				resinModules = _.filter _.values(data.dependencies), (resinModule) ->

					# TODO: Reuse plugin glob from app.coffee
					return _.str.startsWith(resinModule.name, 'resin-plugin')

				console.log visuals.widgets.table.horizontal resinModules, [
					'name'
					'version'
					'description'
					'license'
				]

				return callback()

		], done)
