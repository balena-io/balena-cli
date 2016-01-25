###
Copyright 2016 Resin.io

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
###

_ = require('lodash')
Promise = require('bluebird')
form = require('resin-cli-form')
visuals = require('resin-cli-visuals')
resin = require('resin-sdk')
chalk = require('chalk')
validation = require('./validation')
messages = require('./messages')

exports.authenticate = (options) ->
	return form.run [
			message: 'Email:'
			name: 'email'
			type: 'input'
			validate: validation.validateEmail
		,
			message: 'Password:'
			name: 'password'
			type: 'password'
	],
		override: options
	.then(resin.auth.login)
	.then(resin.auth.twoFactor.isPassed)
	.then (isTwoFactorAuthPassed) ->
		return if isTwoFactorAuthPassed
		return form.ask
			message: 'Two factor auth challenge:'
			name: 'code'
			type: 'input'
		.then(resin.auth.twoFactor.challenge)
		.catch ->
			resin.auth.logout().then ->
				throw new Error('Invalid two factor authentication code')

exports.askLoginType = ->
	return form.ask
		message: 'How would you like to login?'
		name: 'loginType'
		type: 'list'
		choices: [
				name: 'Web authorization (recommended)'
				value: 'web'
			,
				name: 'Credentials'
				value: 'credentials'
			,
				name: 'Authentication token'
				value: 'token'
			,
				name: 'I don\'t have a Resin account!'
				value: 'register'
		]

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

exports.selectApplication = (filter) ->
	resin.models.application.hasAny().then (hasAnyApplications) ->
		if not hasAnyApplications
			throw new Error('You don\'t have any applications')

		return resin.models.application.getAll()
	.filter(filter or _.constant(true))
	.then (applications) ->
		return form.ask
			message: 'Select an application'
			type: 'list'
			choices: _.map applications, (application) ->
				return {
					name: "#{application.app_name} (#{application.device_type})"
					value: application.app_name
				}

exports.selectOrCreateApplication = ->
	resin.models.application.hasAny().then (hasAnyApplications) ->
		return if not hasAnyApplications
		resin.models.application.getAll().then (applications) ->
			applications = _.map applications, (application) ->
				return {
					name: "#{application.app_name} (#{application.device_type})"
					value: application.app_name
				}

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

exports.awaitDevice = (uuid) ->
	resin.models.device.getName(uuid).then (deviceName) ->
		spinner = new visuals.Spinner("Waiting for #{deviceName} to come online")

		poll = ->
			resin.models.device.isOnline(uuid).then (isOnline) ->
				if isOnline
					spinner.stop()
					console.info("The device **#{deviceName}** is online!")
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
	console.error(chalk.red("\n#{messages.getHelp}\n"))
