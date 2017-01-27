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

commandOptions = require('./command-options')

exports.list =
	signature: 'envs'
	description: 'list all environment variables'
	help: '''
		Use this command to list all environment variables for
		a particular application or device.

		This command lists all custom environment variables.
		If you want to see all environment variables, including private
		ones used by resin, use the verbose option.

		Example:

			$ resin envs --application MyApp
			$ resin envs --application MyApp --verbose
			$ resin envs --device 7cf02a6
	'''
	options: [
		commandOptions.optionalApplication
		commandOptions.optionalDevice

		{
			signature: 'verbose'
			description: 'show private environment variables'
			boolean: true
			alias: 'v'
		}
	]
	permission: 'user'
	action: (params, options, done) ->
		Promise = require('bluebird')
		_ = require('lodash')
		resin = require('resin-sdk-preconfigured')
		visuals = require('resin-cli-visuals')

		Promise.try ->
			if options.application?
				return resin.models.environmentVariables.getAllByApplication(options.application)
			else if options.device?
				return resin.models.environmentVariables.device.getAll(options.device)
			else
				throw new Error('You must specify an application or device')

		.tap (environmentVariables) ->
			if _.isEmpty(environmentVariables)
				throw new Error('No environment variables found')
			if not options.verbose
				isSystemVariable = resin.models.environmentVariables.isSystemVariable
				environmentVariables = _.reject(environmentVariables, isSystemVariable)

			console.log visuals.table.horizontal environmentVariables, [
				'id'
				'name'
				'value'
			]
		.nodeify(done)

exports.remove =
	signature: 'env rm <id>'
	description: 'remove an environment variable'
	help: '''
		Use this command to remove an environment variable from an application.

		Don't remove resin specific variables, as things might not work as expected.

		Notice this command asks for confirmation interactively.
		You can avoid this by passing the `--yes` boolean option.

		If you want to eliminate a device environment variable, pass the `--device` boolean option.

		Examples:

			$ resin env rm 215
			$ resin env rm 215 --yes
			$ resin env rm 215 --device
	'''
	options: [
		commandOptions.yes
		commandOptions.booleanDevice
	]
	permission: 'user'
	action: (params, options, done) ->
		resin = require('resin-sdk-preconfigured')
		patterns = require('../utils/patterns')

		patterns.confirm(options.yes, 'Are you sure you want to delete the environment variable?').then ->
			if options.device
				resin.models.environmentVariables.device.remove(params.id)
			else
				resin.models.environmentVariables.remove(params.id)
		.nodeify(done)

exports.add =
	signature: 'env add <key> [value]'
	description: 'add an environment variable'
	help: '''
		Use this command to add an enviroment variable to an application.

		If value is omitted, the tool will attempt to use the variable's value
		as defined in your host machine.

		Use the `--device` option if you want to assign the environment variable
		to a specific device.

		If the value is grabbed from the environment, a warning message will be printed.
		Use `--quiet` to remove it.

		Examples:

			$ resin env add EDITOR vim --application MyApp
			$ resin env add TERM --application MyApp
			$ resin env add EDITOR vim --device 7cf02a6
	'''
	options: [
		commandOptions.optionalApplication
		commandOptions.optionalDevice
	]
	permission: 'user'
	action: (params, options, done) ->
		Promise = require('bluebird')
		resin = require('resin-sdk-preconfigured')

		Promise.try ->
			if not params.value?
				params.value = process.env[params.key]

				if not params.value?
					throw new Error("Environment value not found for key: #{params.key}")
				else
					console.info("Warning: using #{params.key}=#{params.value} from host environment")

			if options.application?
				resin.models.environmentVariables.create(options.application, params.key, params.value)
			else if options.device?
				resin.models.environmentVariables.device.create(options.device, params.key, params.value)
			else
				throw new Error('You must specify an application or device')
		.nodeify(done)

exports.rename =
	signature: 'env rename <id> <value>'
	description: 'rename an environment variable'
	help: '''
		Use this command to rename an enviroment variable from an application.

		Pass the `--device` boolean option if you want to rename a device environment variable.

		Examples:

			$ resin env rename 376 emacs
			$ resin env rename 376 emacs --device
	'''
	permission: 'user'
	options: [ commandOptions.booleanDevice ]
	action: (params, options, done) ->
		Promise = require('bluebird')
		resin = require('resin-sdk-preconfigured')

		Promise.try ->
			if options.device
				resin.models.environmentVariables.device.update(params.id, params.value)
			else
				resin.models.environmentVariables.update(params.id, params.value)
		.nodeify(done)
