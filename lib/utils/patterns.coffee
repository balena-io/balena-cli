_ = require('lodash')
Promise = require('bluebird')
form = require('resin-cli-form')
visuals = require('resin-cli-visuals')
resin = require('resin-sdk')
chalk = require('chalk')
validations = require('./validations')

exports.selectDeviceType = ->
	resin.models.device.getSupportedDeviceTypes().then (deviceTypes) ->
		return form.ask
			message: 'Device Type'
			type: 'list'
			choices: deviceTypes

exports.confirm = (yesOption, message) ->
	Promise.try ->
		return true if yesOption
		return form.ask
			message: message
			type: 'confirm'
			default: false
	.then (confirmed) ->
		if not confirmed
			throw new Error('Aborted')

exports.selectApplication = ->
	resin.models.application.hasAny().then (hasAnyApplications) ->
		if not hasAnyApplications
			throw new Error('You don\'t have any applications')

		resin.models.application.getAll().then (applications) ->
			return form.ask
				message: 'Select an application'
				type: 'list'
				choices: _.pluck(applications, 'app_name')

exports.selectOrCreateApplication = ->
	resin.models.application.hasAny().then (hasAnyApplications) ->
		return if not hasAnyApplications
		resin.models.application.getAll().then (applications) ->
			applications = _.pluck(applications, 'app_name')
			applications.unshift
				name: 'Create a new application'
				value: null

			return form.ask
				message: 'Select an application'
				type: 'list'
				choices: applications
	.then (application) ->
		return application if application?
		form.ask
			message: 'Choose a Name for your new application'
			type: 'input'
			validate: validation.validateApplicationName

exports.selectProjectDirectory = ->
	resin.settings.get('projectsDirectory').then (projectsDirectory) ->
		return form.ask
			message: 'Please choose a directory for your code'
			type: 'input'
			default: projectsDirectory

exports.awaitDevice = (uuid) ->
	resin.models.device.getName(uuid).then (deviceName) ->
		spinner = new visuals.Spinner("Waiting for #{deviceName} to come online")

		poll = ->
			resin.models.device.isOnline(uuid).then (isOnline) ->
				if isOnline
					spinner.stop()
					console.info("Device became online: #{deviceName}")
					return
				else

					# Spinner implementation is smart enough to
					# not start again if it was already started
					spinner.start()

					return Promise.delay(3000).then(poll)

		console.info("Waiting for #{deviceName} to connect to resin...")
		poll().return(uuid)

exports.printErrorMessage = (message) ->
	console.error(chalk.red(message))
