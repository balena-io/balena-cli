_ = require('lodash')
Promise = require('bluebird')
form = require('resin-cli-form')
visuals = require('resin-cli-visuals')
resin = require('resin-sdk')
helpers = require('./helpers')

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

exports.selectProjectDirectory = ->
	resin.settings.get('projectsDirectory').then (projectsDirectory) ->
		return form.ask
			message: 'Please choose a directory for your code'
			type: 'input'
			default: projectsDirectory

exports.awaitDevice = (uuid) ->
	spinner = new visuals.Spinner("Waiting for your device to come online: #{uuid}")

	poll = ->
		resin.models.device.isOnline(uuid).then (isOnline) ->
			if isOnline
				spinner.stop()
				console.info("Device became online: #{uuid}")
				return
			else

				# Spinner implementation is smart enough to
				# not start again if it was already started
				spinner.start()

				return Promise.delay(3000).then(poll)

	resin.models.device.getName(uuid).then (deviceName) ->
		console.info("Waiting for #{deviceName} to connect to resin...")
		poll().return(uuid)
