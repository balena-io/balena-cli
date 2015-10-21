resin = require('resin-sdk')
visuals = require('resin-cli-visuals')
commandOptions = require('./command-options')
events = require('resin-cli-events')
patterns = require('../utils/patterns')

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
	primary: true
	action: (params, options, done) ->

		# Validate the the application name is available
		# before asking the device type.
		# https://github.com/resin-io/resin-cli/issues/30
		resin.models.application.has(params.name).then (hasApplication) ->
			if hasApplication
				throw new Error('You already have an application with that name!')

		.then ->
			return options.type or patterns.selectDeviceType()
		.then (deviceType) ->
			return resin.models.application.create(params.name, deviceType)
		.then (application) ->
			console.info("Application created: #{application.app_name} (#{application.device_type}, id #{application.id})")
			events.send('application.create', application: application.id)
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
	primary: true
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
	primary: true
	action: (params, options, done) ->
		resin.models.application.get(params.name).then (application) ->
			console.log visuals.table.vertical application, [
				"$#{application.app_name}$"
				'id'
				'device_type'
				'git_repository'
				'commit'
			]
			events.send('application.open', application: application.id)
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
		patterns.confirm(options.yes, 'Are you sure you want to delete the application?').then ->
			resin.models.application.remove(params.name)
		.tap ->
			resin.models.application.get(params.name).then (application) ->
				events.send('application.delete', application: application.id)
		.nodeify(done)
