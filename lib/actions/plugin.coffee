_ = require('lodash')
visuals = require('resin-cli-visuals')
commandOptions = require('./command-options')
plugins = require('../plugins')
form = require('resin-cli-form')
async = require('async')

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
		plugins.list (error, resinPlugins) ->
			return done(error) if error?

			if _.isEmpty(resinPlugins)
				console.log('You don\'t have any plugins yet')
				return done()

			console.log visuals.table.horizontal resinPlugins, [
				'name'
				'version'
				'description'
				'license'
			]

			return done()

exports.install =
	signature: 'plugin install <name>'
	description: 'install a plugin'
	help: '''
		Use this command to install a resin plugin

		Use `--quiet` to prevent information logging.

		Examples:

			$ resin plugin install hello
	'''
	permission: 'user'
	action: (params, options, done) ->
		plugins.install params.name, (error) ->
			return done(error) if error?
			console.info("Plugin installed: #{params.name}")
			return done()

exports.update =
	signature: 'plugin update <name>'
	description: 'update a plugin'
	help: '''
		Use this command to update a resin plugin

		Use `--quiet` to prevent information logging.

		Examples:

			$ resin plugin update hello
	'''
	permission: 'user'
	action: (params, options, done) ->
		plugins.update params.name, (error, version) ->
			return done(error) if error?
			console.info("Plugin updated: #{params.name}@#{version}")
			return done()

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
		async.waterfall [

			(callback) ->
				if options.yes
					return callback(null, true)
				else
					form.ask
						message: 'Are you sure you want to delete the plugin?'
						type: 'confirm'
						default: false
					.nodeify(callback)

			(confirmed, callback) ->
				return callback() if not confirmed
				plugins.remove(params.name, callback)
		, (error) ->
			return done(error) if error?
			console.info("Plugin removed: #{params.name}")
			return done()
		]
