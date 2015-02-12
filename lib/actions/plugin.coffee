_ = require('lodash')
_.str = require('underscore.string')
async = require('async')
npm = require('npm')
visuals = require('resin-cli-visuals')
commandOptions = require('./command-options')

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
					depth: 0
					parseable: true
				, callback

			(data, callback) ->
				npm.commands.list([], true, callback)

			(data, lite, callback) ->
				resinModules = _.filter _.values(data.dependencies), (resinModule) ->

					# TODO: Reuse plugin glob from app.coffee
					return _.str.startsWith(resinModule.name, 'resin-plugin')

				if _.isEmpty(resinModules)
					console.log('You don\'t have any plugins yet')
					return done()

				console.log visuals.widgets.table.horizontal resinModules, [
					'name'
					'version'
					'description'
					'license'
				]

				return callback()

		], done)

exports.install =
	signature: 'plugin install <name>'
	description: 'install a plugin'
	help: '''
		Use this command to install a resin plugin

		Examples:
			$ resin plugin install hello
	'''
	permission: 'user'
	action: (params, options, done) ->
		async.waterfall [

			(callback) ->
				npm.load({}, callback)

			(data, callback) ->

				# TODO: This action outputs installation information that cannot
				# be quieted neither with --quiet nor --silent:
				# https://github.com/npm/npm/issues/2040
				npm.commands.install([
					"resin-plugin-#{params.name}"
				], callback)

				# TODO: Print installed plugins names

		], (error) ->
			return done() if not error?

			if error.code is 'E404'
				error.message = "Plugin not found: #{params.name}"

			return done(error) if error?

exports.remove =
	signature: 'plugin rm <name>'
	description: 'remove a plugin'
	help: '''
		Use this command to remove a resin.io plugin.

		Notice this command asks for confirmation interactively.
		You can avoid this by passing the `--yes` boolean option.

		Examples:
			$ resin plugin rm hello
			$ resin plugin rm hello --yes
	'''
	options: [ commandOptions.yes ]
	permission: 'user'
	action: (params, options, done) ->
		async.waterfall([

			(callback) ->
				npm.load(loglevel: 'silent', callback)

			(data, callback) ->
				visuals.patterns.remove 'plugin', options.yes, (callback) ->
					npm.commands.uninstall([
						"resin-plugin-#{params.name}"
					], callback)
				, callback

			(uninstalledPlugins, callback) ->
				if _.isEmpty(uninstalledPlugins)
					return callback(new Error("Plugin not found: #{params.name}"))
				console.info("Plugin removed: #{params.name}")
				return callback()

		], done)
