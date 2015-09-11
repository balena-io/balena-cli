_ = require('lodash')
Promise = require('bluebird')
form = require('resin-cli-form')
visuals = require('resin-cli-visuals')
resin = require('resin-sdk')
manager = require('resin-image-manager')
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
	spinner = new visuals.Spinner("Awaiting device: #{uuid}")

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

exports.askDeviceOptions = (deviceType) ->
	resin.models.config.getDeviceOptions(deviceType).then(form.run)
	.then (answers) ->
		answers.os ?= helpers.getOperatingSystem()
		return answers

exports.download = (deviceType) ->
	manager.get(deviceType).then (stream) ->
		bar = new visuals.Progress('Downloading Device OS')
		spinner = new visuals.Spinner('Downloading Device OS (size unknown)')

		stream.on 'progress', (state) ->
			if state?
				bar.update(state)
			else
				spinner.start()

		stream.on 'end', ->
			spinner.stop()

		return manager.pipeTemporal(stream)
