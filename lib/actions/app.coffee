path = require('path')
_ = require('lodash-contrib')
async = require('async')
resin = require('resin-sdk')
visuals = require('resin-cli-visuals')
commandOptions = require('./command-options')
vcs = require('resin-vcs')
form = require('resin-cli-form')

exports.create =
	signature: 'app create <name>'
	description: 'create an application'
	help: '''
		Use this command to create a new resin.io application.

		You can specify the application type with the `--type` option.
		Otherwise, an interactive dropdown will be shown for you to select from.

		You can see a list of supported device types with

			$ resin devices supported

		Examples:

			$ resin app create MyApp
			$ resin app create MyApp --type raspberry-pi
	'''
	options: [
		{
			signature: 'type'
			parameter: 'type'
			description: 'application type'
			alias: 't'
		}
	]
	permission: 'user'
	action: (params, options, done) ->
		async.waterfall [

			(callback) ->
				resin.models.application.has(params.name).nodeify(callback)

			(hasApplication, callback) ->
				if hasApplication
					return callback(new Error('You already have an application with that name!'))

				return callback(null, options.type) if options.type?
				resin.models.device.getSupportedDeviceTypes().then (supportedDeviceTypes) ->
					form.ask
						message: 'Device Type'
						type: 'list'
						choices: supportedDeviceTypes
				.nodeify(callback)

			(type, callback) ->
				options.type = type
				resin.models.application.create(params.name, options.type).nodeify(callback)

			(applicationId, callback) ->
				console.info("Application created: #{params.name} (#{options.type}, id #{applicationId})")
				return callback()

		], done

exports.list =
	signature: 'apps'
	description: 'list all applications'
	help: '''
		Use this command to list all your applications.

		Notice this command only shows the most important bits of information for each app.
		If you want detailed information, use resin app <name> instead.

		Examples:

			$ resin apps
	'''
	permission: 'user'
	action: (params, options, done) ->
		resin.models.application.getAll().then (applications) ->
			console.log visuals.table.horizontal applications, [
				'id'
				'app_name'
				'device_type'
				'online_devices'
				'devices_length'
			]
		.nodeify(done)

exports.info =
	signature: 'app <name>'
	description: 'list a single application'
	help: '''
		Use this command to show detailed information for a single application.

		Examples:

			$ resin app MyApp
	'''
	permission: 'user'
	action: (params, options, done) ->
		resin.models.application.get(params.name).then (application) ->
			console.log visuals.table.vertical application, [
				"$#{application.app_name}$"
				'id'
				'device_type'
				'git_repository'
				'commit'
			]
		.nodeify(done)

exports.restart =
	signature: 'app restart <name>'
	description: 'restart an application'
	help: '''
		Use this command to restart all devices that belongs to a certain application.

		Examples:

			$ resin app restart MyApp
	'''
	permission: 'user'
	action: (params, options, done) ->
		resin.models.application.restart(params.name).nodeify(done)

exports.remove =
	signature: 'app rm <name>'
	description: 'remove an application'
	help: '''
		Use this command to remove a resin.io application.

		Notice this command asks for confirmation interactively.
		You can avoid this by passing the `--yes` boolean option.

		Examples:

			$ resin app rm MyApp
			$ resin app rm MyApp --yes
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
						message: 'Are you sure you want to delete the application?'
						type: 'confirm'
						default: false
					.nodeify(callback)

			(confirmed, callback) ->
				return callback() if not confirmed
				resin.models.application.remove(params.name).nodeify(callback)
		], done

exports.associate =
	signature: 'app associate <name>'
	description: 'associate a resin project'
	help: '''
		Use this command to associate a project directory with a resin application.

		This command adds a 'resin' git remote to the directory and runs git init if necessary.

		Notice this command asks for confirmation interactively.
		You can avoid this by passing the `--yes` boolean option.

		Examples:

			$ resin app associate MyApp
			$ resin app associate MyApp --project my/app/directory
	'''
	options: [ commandOptions.yes ]
	permission: 'user'
	action: (params, options, done) ->
		currentDirectory = process.cwd()

		async.waterfall [

			(callback) ->
				resin.models.application.has(params.name).nodeify(callback)

			(hasApp, callback) ->
				if not hasApp
					return callback(new Error("Invalid application: #{params.name}"))

				message = "Are you sure you want to associate #{currentDirectory} with #{params.name}?"
				if options.yes
					return callback(null, true)
				else
					form.ask
						message: message
						type: 'confirm'
						default: false
					.nodeify(callback)

			(confirmed, callback) ->
				return done() if not confirmed
				vcs.initialize(currentDirectory).nodeify(callback)

			(callback) ->
				resin.models.application.get(params.name).nodeify(callback)

			(application, callback) ->
				vcs.associate(currentDirectory, application.git_repository).nodeify(callback)

		], (error, remoteUrl) ->
			return done(error) if error?
			console.info("git repository added: #{remoteUrl}")
			return done(null, remoteUrl)

exports.init =
	signature: 'init'
	description: 'init an application'
	help: '''
		Use this command to initialise a directory as a resin application.

		This command performs the following steps:
			- Create a resin.io application.
			- Initialize the current directory as a git repository.
			- Add the corresponding git remote to the application.

		Examples:

			$ resin init
			$ resin init --project my/app/directory
	'''
	permission: 'user'
	action: (params, options, done) ->

		currentDirectory = process.cwd()

		async.waterfall [

			(callback) ->
				currentDirectoryBasename = path.basename(currentDirectory)
				form.ask
					message: 'What is the name of your application?'
					type: 'input'
					default: currentDirectoryBasename
				.nodeify(callback)

			(applicationName, callback) ->

				# TODO: Make resin.models.application.create return
				# the whole application instead of just the id
				exports.create.action name: applicationName, options, (error) ->
					return callback(error) if error?
					return callback(null, applicationName)

			(applicationName, callback) ->
				exports.associate.action(name: applicationName, options, callback)

		], done
