_ = require('lodash')
resin = require('resin-sdk')
visuals = require('resin-cli-visuals')
commandOptions = require('./command-options')
vcs = require('resin-vcs')
helpers = require('../utils/helpers')

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

		# Validate the the application name is available
		# before asking the device type.
		# https://github.com/resin-io/resin-cli/issues/30
		resin.models.application.has(params.name).then (hasApplication) ->
			if hasApplication
				throw new Error('You already have an application with that name!')

		.then(helpers.selectDeviceType).then (deviceType) ->
			return resin.models.application.create(params.name, deviceType)
		.then (application) ->
			console.info("Application created: #{application.app_name} (#{application.device_type}, id #{application.id})")
		.nodeify(done)

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
		helpers.confirm(option.yes, 'Are you sure you want to delete the application?').then (confirmed) ->
			return if not confirmed
			resin.models.application.remove(params.name)
		.nodeify(done)

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
	'''
	options: [ commandOptions.yes ]
	permission: 'user'
	action: (params, options, done) ->
		currentDirectory = process.cwd()

		resin.models.application.has(params.name).then (hasApplication) ->
			if not hasApplication
				throw new Error("Invalid application: #{params.name}")

		.then ->
			message = "Are you sure you want to associate #{currentDirectory} with #{params.name}?"
			helpers.confirm(options.yes, message)

		.then (confirmed) ->
			return if not confirmed

			resin.models.application.get(params.name).get('git_repository').then (gitRepository) ->
				vcs.initialize(currentDirectory).then ->
					return vcs.associate(currentDirectory, gitRepository)
				.then ->
					console.info("git repository added: #{gitRepository}")
					return gitRepository

		.nodeify(done)
