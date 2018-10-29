###
Copyright 2016-2017 Balena

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

commandOptions = require('./command-options')

exports.create =
	signature: 'app create <name>'
	description: 'create an application'
	help: '''
		Use this command to create a new balena application.

		You can specify the application device type with the `--type` option.
		Otherwise, an interactive dropdown will be shown for you to select from.

		You can see a list of supported device types with

			$ balena devices supported

		Examples:

			$ balena app create MyApp
			$ balena app create MyApp --type raspberry-pi
	'''
	options: [
		{
			signature: 'type'
			parameter: 'type'
			description: 'application device type (Check available types with `balena devices supported`)'
			alias: 't'
		}
	]
	permission: 'user'
	action: (params, options, done) ->
		balena = require('balena-sdk').fromSharedOptions()

		patterns = require('../utils/patterns')

		# Validate the the application name is available
		# before asking the device type.
		# https://github.com/balena-io/balena-cli/issues/30
		balena.models.application.has(params.name).then (hasApplication) ->
			if hasApplication
				patterns.exitWithExpectedError('You already have an application with that name!')

		.then ->
			return options.type or patterns.selectDeviceType()
		.then (deviceType) ->
			return balena.models.application.create({
				name: params.name
				deviceType
			})
		.then (application) ->
			console.info("Application created: #{application.app_name} (#{application.device_type}, id #{application.id})")
		.nodeify(done)

exports.list =
	signature: 'apps'
	description: 'list all applications'
	help: '''
		Use this command to list all your applications.

		Notice this command only shows the most important bits of information for each app.
		If you want detailed information, use balena app <name> instead.

		Examples:

			$ balena apps
	'''
	permission: 'user'
	primary: true
	action: (params, options, done) ->
		balena = require('balena-sdk').fromSharedOptions()
		visuals = require('resin-cli-visuals')

		balena.models.application.getAll().then (applications) ->
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

			$ balena app MyApp
	'''
	permission: 'user'
	primary: true
	action: (params, options, done) ->
		balena = require('balena-sdk').fromSharedOptions()
		visuals = require('resin-cli-visuals')

		balena.models.application.get(params.name).then (application) ->
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

			$ balena app restart MyApp
	'''
	permission: 'user'
	action: (params, options, done) ->
		balena = require('balena-sdk').fromSharedOptions()
		balena.models.application.restart(params.name).nodeify(done)

exports.remove =
	signature: 'app rm <name>'
	description: 'remove an application'
	help: '''
		Use this command to remove a balena application.

		Notice this command asks for confirmation interactively.
		You can avoid this by passing the `--yes` boolean option.

		Examples:

			$ balena app rm MyApp
			$ balena app rm MyApp --yes
	'''
	options: [ commandOptions.yes ]
	permission: 'user'
	action: (params, options, done) ->
		balena = require('balena-sdk').fromSharedOptions()
		patterns = require('../utils/patterns')

		patterns.confirm(options.yes, 'Are you sure you want to delete the application?').then ->
			balena.models.application.remove(params.name)
		.nodeify(done)
