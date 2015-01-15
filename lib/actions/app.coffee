_ = require('lodash-contrib')
async = require('async')
resin = require('resin-sdk')
ui = require('../ui')
permissions = require('../permissions/permissions')
commandOptions = require('./command-options')

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
	action: permissions.user (params, options, done) ->
		async.waterfall([

			(callback) ->
				deviceType = options.type

				if deviceType?
					return callback(null, deviceType)
				else
					deviceTypes = resin.models.device.getSupportedDeviceTypes()
					ui.widgets.select('Select a type', deviceTypes, callback)

			(type, callback) ->
				resin.models.application.create(params.name, type, callback)

		], done)

exports.list =
	signature: 'apps'
	description: 'list all applications'
	help: '''
		Use this command to list all your applications.

		Notice this command only shows the most important bits of information for each app.
		If you want detailed information, use resin app <id> instead.

		Examples:
			$ resin apps
	'''
	action: permissions.user (params, options, done) ->
		resin.models.application.getAll (error, applications) ->
			return done(error) if error?
			console.log ui.widgets.table.horizontal applications, [
				'ID'
				'Name'
				'Device Display Name'
				'Online Devices'
				'Devices Length'
			]
			return done()

exports.info =
	signature: 'app <id>'
	description: 'list a single application'
	help: '''
		Use this command to show detailed information for a single application.

		Examples:
			$ resin app 91
	'''
	action: permissions.user (params, options, done) ->
		resin.models.application.get params.id, (error, application) ->
			return done(error) if error?
			console.log ui.widgets.table.vertical application, [
				'ID'
				'Name'
				'Device Display Name'
				'Git Repository'
				'Commit'
			]
			return done()

exports.restart =
	signature: 'app restart <id>'
	description: 'restart an application'
	help: '''
		Use this command to restart all devices that belongs to a certain application.

		Examples:
			$ resin app restart 91
	'''
	action: permissions.user (params, options, done) ->
		resin.models.application.restart(params.id, done)

exports.remove =
	signature: 'app rm <id>'
	description: 'remove an application'
	help: '''
		Use this command to remove a resin.io application.

		Notice this command asks for confirmation interactively.
		You can avoid this by passing the `--yes` boolean option.

		Examples:
			$ resin app rm 91
			$ resin app rm 91 --yes
	'''
	options: [ commandOptions.yes ]
	action: permissions.user (params, options, done) ->
		ui.patterns.remove 'application', options.yes, (callback) ->
			resin.models.application.remove(params.id, callback)
		, done

exports.init =
	signature: 'init <id>'
	description: 'init an application'
	help: '''
		Use this command to associate a local project to an existing resin.io application.

		The application should be a git repository before issuing this command.
		Notice this command adds a `resin` git remote to your application.

		Examples:
			$ cd myApp && resin init 91
	'''
	action: permissions.user (params, options, done) ->
		currentDirectory = process.cwd()

		async.waterfall [

			(callback) ->
				resin.vcs.isResinProject(currentDirectory, callback)

			(isResinProject, callback) ->
				if isResinProject
					error = new Error('Project is already a resin application.')
					return callback(error)
				return callback()

			(callback) ->
				resin.models.application.get(params.id, callback)

			(application, callback) ->
				resin.vcs.initProjectWithApplication(application, currentDirectory, callback)

		], done
