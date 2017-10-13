###
Copyright 2016-2017 Resin.io

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

exports.read =
	signature: 'config read'
	description: 'read a device configuration'
	help: '''
		Use this command to read the config.json file from the mounted filesystem (e.g. SD card) of a provisioned device"

		Examples:

			$ resin config read --type raspberry-pi
			$ resin config read --type raspberry-pi --drive /dev/disk2
	'''
	options: [
		{
			signature: 'type'
			description: 'device type (Check available types with `resin devices supported`)'
			parameter: 'type'
			alias: 't'
			required: 'You have to specify a device type'
		}
		{
			signature: 'drive'
			description: 'drive'
			parameter: 'drive'
			alias: 'd'
		}
	]
	permission: 'user'
	root: true
	action: (params, options, done) ->
		Promise = require('bluebird')
		config = require('resin-config-json')
		visuals = require('resin-cli-visuals')
		umountAsync = Promise.promisify(require('umount').umount)
		prettyjson = require('prettyjson')

		Promise.try ->
			return options.drive or visuals.drive('Select the device drive')
		.tap(umountAsync)
		.then (drive) ->
			return config.read(drive, options.type)
		.tap (configJSON) ->
			console.info(prettyjson.render(configJSON))
		.nodeify(done)

exports.write =
	signature: 'config write <key> <value>'
	description: 'write a device configuration'
	help: '''
		Use this command to write the config.json file to the mounted filesystem (e.g. SD card) of a provisioned device

		Examples:

			$ resin config write --type raspberry-pi username johndoe
			$ resin config write --type raspberry-pi --drive /dev/disk2 username johndoe
			$ resin config write --type raspberry-pi files.network/settings "..."
	'''
	options: [
		{
			signature: 'type'
			description: 'device type (Check available types with `resin devices supported`)'
			parameter: 'type'
			alias: 't'
			required: 'You have to specify a device type'
		}
		{
			signature: 'drive'
			description: 'drive'
			parameter: 'drive'
			alias: 'd'
		}
	]
	permission: 'user'
	root: true
	action: (params, options, done) ->
		Promise = require('bluebird')
		_ = require('lodash')
		config = require('resin-config-json')
		visuals = require('resin-cli-visuals')
		umountAsync = Promise.promisify(require('umount').umount)

		Promise.try ->
			return options.drive or visuals.drive('Select the device drive')
		.tap(umountAsync)
		.then (drive) ->
			config.read(drive, options.type).then (configJSON) ->
				console.info("Setting #{params.key} to #{params.value}")
				_.set(configJSON, params.key, params.value)
				return configJSON
			.tap ->
				return umountAsync(drive)
			.then (configJSON) ->
				return config.write(drive, options.type, configJSON)
		.tap ->
			console.info('Done')
		.nodeify(done)

exports.inject =
	signature: 'config inject <file>'
	description: 'inject a device configuration file'
	help: '''
		Use this command to inject a config.json file to the mounted filesystem (e.g. SD card) of a provisioned device"

		Examples:

			$ resin config inject my/config.json --type raspberry-pi
			$ resin config inject my/config.json --type raspberry-pi --drive /dev/disk2
	'''
	options: [
		{
			signature: 'type'
			description: 'device type (Check available types with `resin devices supported`)'
			parameter: 'type'
			alias: 't'
			required: 'You have to specify a device type'
		}
		{
			signature: 'drive'
			description: 'drive'
			parameter: 'drive'
			alias: 'd'
		}
	]
	permission: 'user'
	root: true
	action: (params, options, done) ->
		Promise = require('bluebird')
		config = require('resin-config-json')
		visuals = require('resin-cli-visuals')
		umountAsync = Promise.promisify(require('umount').umount)
		readFileAsync = Promise.promisify(require('fs').readFile)

		Promise.try ->
			return options.drive or visuals.drive('Select the device drive')
		.tap(umountAsync)
		.then (drive) ->
			readFileAsync(params.file, 'utf8').then(JSON.parse).then (configJSON) ->
				return config.write(drive, options.type, configJSON)
		.tap ->
			console.info('Done')
		.nodeify(done)

exports.reconfigure =
	signature: 'config reconfigure'
	description: 'reconfigure a provisioned device'
	help: '''
		Use this command to reconfigure a provisioned device

		Examples:

			$ resin config reconfigure --type raspberry-pi
			$ resin config reconfigure --type raspberry-pi --advanced
			$ resin config reconfigure --type raspberry-pi --drive /dev/disk2
	'''
	options: [
		{
			signature: 'type'
			description: 'device type (Check available types with `resin devices supported`)'
			parameter: 'type'
			alias: 't'
			required: 'You have to specify a device type'
		}
		{
			signature: 'drive'
			description: 'drive'
			parameter: 'drive'
			alias: 'd'
		}
		{
			signature: 'advanced'
			description: 'show advanced commands'
			boolean: true
			alias: 'v'
		}
	]
	permission: 'user'
	root: true
	action: (params, options, done) ->
		Promise = require('bluebird')
		config = require('resin-config-json')
		visuals = require('resin-cli-visuals')
		capitanoRunAsync = Promise.promisify(require('capitano').run)
		umountAsync = Promise.promisify(require('umount').umount)

		Promise.try ->
			return options.drive or visuals.drive('Select the device drive')
		.tap(umountAsync)
		.then (drive) ->
			config.read(drive, options.type).get('uuid')
				.tap ->
					umountAsync(drive)
				.then (uuid) ->
					configureCommand = "os configure #{drive} #{uuid}"
					if options.advanced
						configureCommand += ' --advanced'
					return capitanoRunAsync(configureCommand)
		.then ->
			console.info('Done')
		.nodeify(done)

exports.generate =
	signature: 'config generate'
	description: 'generate a config.json file'
	help: '''
		Use this command to generate a config.json for a device or application

		Examples:

			$ resin config generate --device 7cf02a6
			$ resin config generate --device 7cf02a6 --device-api-key <existingDeviceKey>
			$ resin config generate --device 7cf02a6 --output config.json
			$ resin config generate --app MyApp
			$ resin config generate --app MyApp --output config.json
	'''
	options: [
		commandOptions.optionalApplication
		commandOptions.optionalDevice
		{
			signature: 'deviceApiKey'
			description: 'custom device key - note that this is only supported on ResinOS 2.0.3+'
			parameter: 'device-api-key'
			alias: 'k'
		}
		{
			signature: 'output'
			description: 'output'
			parameter: 'output'
			alias: 'o'
		}
	]
	permission: 'user'
	action: (params, options, done) ->
		Promise = require('bluebird')
		writeFileAsync = Promise.promisify(require('fs').writeFile)
		resin = require('resin-sdk-preconfigured')
		_ = require('lodash')
		form = require('resin-cli-form')
		deviceConfig = require('resin-device-config')
		prettyjson = require('prettyjson')
		{ generateDeviceConfig, generateApplicationConfig } = require('../utils/config')

		if not options.device? and not options.application?
			throw new Error '''
				You have to pass either a device or an application.

				See the help page for examples:

				  $ resin help config generate
			'''

		Promise.try ->
			if options.device?
				return resin.models.device.get(options.device)
			return resin.models.application.get(options.application)
		.then (resource) ->
			resin.models.device.getManifestBySlug(resource.device_type)
			.get('options')
			.then(form.run)
			.then (answers) ->
				if resource.uuid?
					generateDeviceConfig(resource, options.deviceApiKey, answers)
				else
					generateApplicationConfig(resource, answers)
		.then (config) ->
			deviceConfig.validate(config)
			if options.output?
				return writeFileAsync(options.output, JSON.stringify(config))

			console.log(prettyjson.render(config))
		.nodeify(done)
