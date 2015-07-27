async = require('async')
_ = require('lodash-contrib')
resin = require('resin-sdk')
visuals = require('resin-cli-visuals')
commandOptions = require('./command-options')

exports.list =
	signature: 'envs'
	description: 'list all environment variables'
	help: '''
		Use this command to list all environment variables for
		a particular application or device.

		This command lists all custom environment variables.
		If you want to see all environment variables, including private
		ones used by resin, use the verbose option.

		Example:

			$ resin envs --application MyApp
			$ resin envs --application MyApp --verbose
			$ resin envs --device 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9
	'''
	options: [
		commandOptions.optionalApplication
		commandOptions.optionalDevice

		{
			signature: 'verbose'
			description: 'show private environment variables'
			boolean: true
			alias: 'v'
		}
	]
	permission: 'user'
	action: (params, options, done) ->
		async.waterfall [

			(callback) ->
				if options.application?
					resin.models.environmentVariables.getAllByApplication(options.application).nodeify(callback)
				else if options.device?
					resin.models.environmentVariables.device.getAll(options.device).nodeify(callback)
				else
					return callback(new Error('You must specify an application or device'))

			(environmentVariables, callback) ->

				if not options.verbose
					isSystemVariable = resin.models.environmentVariables.isSystemVariable
					environmentVariables = _.reject(environmentVariables, isSystemVariable)

				console.log visuals.widgets.table.horizontal environmentVariables, [
					'id'
					'name'
					'value'
				]

				return callback()

		], done

exports.remove =
	signature: 'env rm <id>'
	description: 'remove an environment variable'
	help: '''
		Use this command to remove an environment variable from an application.

		Don't remove resin specific variables, as things might not work as expected.

		Notice this command asks for confirmation interactively.
		You can avoid this by passing the `--yes` boolean option.

		If you want to eliminate a device environment variable, pass the `--device` boolean option.

		Examples:

			$ resin env rm 215
			$ resin env rm 215 --yes
			$ resin env rm 215 --device
	'''
	options: [
		commandOptions.yes
		commandOptions.booleanDevice
	]
	permission: 'user'
	action: (params, options, done) ->
		async.waterfall [

			(callback) ->
				if options.yes
					return callback(null, true)
				else
					form.ask
						message: 'Are you sure you want to delete the environment variable?'
						type: 'confirm'
						default: false
					.nodeify(callback)

			(confirmed, callback) ->
				return callback() if not confirmed
				if options.device
					resin.models.environmentVariables.device.remove(params.id).nodeify(callback)
				else
					resin.models.environmentVariables.remove(params.id).nodeify(callback)
		], done

exports.add =
	signature: 'env add <key> [value]'
	description: 'add an environment variable'
	help: '''
		Use this command to add an enviroment variable to an application.

		If value is omitted, the tool will attempt to use the variable's value
		as defined in your host machine.

		Use the `--device` option if you want to assign the environment variable
		to a specific device.

		If the value is grabbed from the environment, a warning message will be printed.
		Use `--quiet` to remove it.

		Examples:

			$ resin env add EDITOR vim --application MyApp
			$ resin env add TERM --application MyApp
			$ resin env add EDITOR vim --device MyDevice
	'''
	options: [
		commandOptions.optionalApplication
		commandOptions.optionalDevice
	]
	permission: 'user'
	action: (params, options, done) ->
		if not params.value?
			params.value = process.env[params.key]

			if not params.value?
				return done(new Error("Environment value not found for key: #{params.key}"))
			else
				console.info("Warning: using #{params.key}=#{params.value} from host environment")

		if options.application?
			resin.models.environmentVariables.create(options.application, params.key, params.value).nodeify(done)
		else if options.device?
			resin.models.environmentVariables.device.create(options.device, params.key, params.value).nodeify(done)
		else
			return done(new Error('You must specify an application or device'))

exports.rename =
	signature: 'env rename <id> <value>'
	description: 'rename an environment variable'
	help: '''
		Use this command to rename an enviroment variable from an application.

		Pass the `--device` boolean option if you want to rename a device environment variable.

		Examples:

			$ resin env rename 376 emacs
			$ resin env rename 376 emacs --device
	'''
	permission: 'user'
	options: [ commandOptions.booleanDevice ]
	action: (params, options, done) ->
		if options.device
			resin.models.environmentVariables.device.update(params.id, params.value).nodeify(done)
		else
			resin.models.environmentVariables.update(params.id, params.value).nodeify(done)
