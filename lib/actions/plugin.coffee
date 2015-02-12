_ = require('lodash')
visuals = require('resin-cli-visuals')
commandOptions = require('./command-options')
plugins = require('../plugins')

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
		plugins.list 'resin-plugin', (error, resinPlugins) ->
			return done(error) if error?

			if _.isEmpty(resinPlugins)
				console.log('You don\'t have any plugins yet')
				return done()

			console.log visuals.widgets.table.horizontal resinPlugins, [
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

		Examples:
			$ resin plugin install hello
	'''
	permission: 'user'
	action: (params, options, done) ->
		plugins.install "resin-plugin-#{params.name}", (error, installedModules) ->
			return done(error) if error?

			for installedModule in installedModules
				console.info("Plugin installed: #{installedModule}")

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
		visuals.patterns.remove 'plugin', options.yes, (callback) ->
			plugins.remove("resin-plugin-#{params.name}", callback)
		, (error, uninstalledPlugin) ->
			return done(error) if error?

			console.info("Plugin removed: #{uninstalledPlugin}")

			return done()
