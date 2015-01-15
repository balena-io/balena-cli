_ = require('lodash-contrib')
resin = require('resin-sdk')
ui = require('../ui')
permissions = require('../permissions/permissions')
commandOptions = require('./command-options')

exports.list =
	signature: 'envs'
	description: 'list all environment variables'
	help: '''
		Use this command to list all environment variables for a particular application.
		Notice we will support per-device environment variables soon.

		This command lists all custom environment variables set on the devices running
		the application. If you want to see all environment variables, including private
		ones used by resin, use the verbose option.

		Example:
			$ resin envs --application 91
			$ resin envs --application 91 --verbose
	'''
	options: [
		commandOptions.application

		{
			signature: 'verbose'
			description: 'show private environment variables'
			boolean: true
			alias: 'v'
		}
	]
	action: permissions.user (params, options, done) ->
		resin.models.environmentVariables.getAllByApplication options.application, (error, environmentVariables) ->
			return done(error) if error?

			if not options.verbose
				environmentVariables = _.reject(environmentVariables, resin.models.environmentVariables.isSystemVariable)

			console.log(ui.widgets.table.horizontal(environmentVariables))
			return done()

exports.remove =
	signature: 'env rm <id>'
	description: 'remove an environment variable'
	help: '''
		Use this command to remove an environment variable from an application.

		Don't remove resin specific variables, as things might not work as expected.

		Notice this command asks for confirmation interactively.
		You can avoid this by passing the `--yes` boolean option.

		Examples:
			$ resin env rm 215
			$ resin env rm 215 --yes
	'''
	options: [ commandOptions.yes ]
	action: permissions.user (params, options, done) ->
		ui.patterns.remove 'environment variable', options.yes, (callback) ->
			resin.models.environmentVariables.remove(params.id, callback)
		, done

exports.add =
	signature: 'env add <key> [value]'
	description: 'add an environment variable'
	help: '''
		Use this command to add an enviroment variable to an application.

		You need to pass the `--application` option.

		If value is omitted, the tool will attempt to use the variable's value
		as defined in your host machine.

		If the value is grabbed from the environment, a warning message will be printed.
		Use `--quiet` to remove it.

		Examples:
			$ resin env add EDITOR vim -a 91
			$ resin env add TERM -a 91
	'''
	options: [ commandOptions.application ]
	action: permissions.user (params, options, done) ->
		if not params.value?
			params.value = process.env[params.key]

			if not params.value?
				return done(new Error("Environment value not found for key: #{params.key}"))
			else
				console.info("Warning: using #{params.key}=#{params.value} from host environment")

		resin.models.environmentVariables.create(options.application, params.key, params.value, done)

exports.rename =
	signature: 'env rename <id> <value>'
	description: 'rename an environment variable'
	help: '''
		Use this command to rename an enviroment variable from an application.

		Examples:
			$ resin env rename 376 emacs
	'''
	action: permissions.user (params, options, done) ->
		resin.models.environmentVariables.update(params.id, params.value, done)
