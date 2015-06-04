path = require('path')
_ = require('lodash-contrib')
async = require('async')
resin = require('resin-sdk')
visuals = require('resin-cli-visuals')
commandOptions = require('./command-options')
vcs = require('resin-vcs')

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
		async.waterfall([

			(callback) ->
				resin.models.application.has(params.name, callback)

			(hasApplication, callback) ->
				if hasApplication
					return callback(new Error('You already have an application with that name!'))

				return callback(null, options.type) if options.type?

				resin.models.device.getSupportedDeviceTypes (error, deviceTypes) ->
					return callback(error) if error?
					visuals.widgets.select('Select a type', deviceTypes, callback)

			(type, callback) ->
				options.type = type
				resin.models.application.create(params.name, options.type, callback)

			(applicationId, callback) ->
				console.info("Application created: #{params.name} (#{options.type}, id #{applicationId})")
				return callback()

		], done)

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
		resin.models.application.getAll (error, applications) ->
			return done(error) if error?
			console.log visuals.widgets.table.horizontal applications, [
				'id'
				'app_name'
				'device_type'
				'online_devices'
				'devices_length'
			]
			return done()

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
		resin.models.application.get params.name, (error, application) ->
			return done(error) if error?
			console.log visuals.widgets.table.vertical application, [
				'id'
				'app_name'
				'device_type'
				'git_repository'
				'commit'
			]
			return done()

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
		resin.models.application.restart(params.name, done)

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
		visuals.patterns.remove 'application', options.yes, (callback) ->
			resin.models.application.remove(params.name, callback)
		, done

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
				resin.models.application.has(params.name, callback)

			(hasApp, callback) ->
				if not hasApp
					return callback(new Error("Invalid application: #{params.name}"))

				message = "Are you sure you want to associate #{currentDirectory} with #{params.name}?"
				visuals.patterns.confirm(options.yes, message, callback)

			(confirmed, callback) ->
				return done() if not confirmed
				vcs.initialize(currentDirectory, callback)

			(callback) ->
				resin.models.application.get(params.name, callback)

			(application, callback) ->
				vcs.addRemote(currentDirectory, application.git_repository, callback)

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

		async.waterfall([

			(callback) ->
				currentDirectoryBasename = path.basename(currentDirectory)
				visuals.widgets.ask('What is the name of your application?', currentDirectoryBasename, callback)

			(applicationName, callback) ->

				# TODO: Make resin.models.application.create return
				# the whole application instead of just the id
				exports.create.action name: applicationName, options, (error) ->
					return callback(error) if error?
					return callback(null, applicationName)

			(applicationName, callback) ->
				exports.associate.action(name: applicationName, options, callback)

		], done)
