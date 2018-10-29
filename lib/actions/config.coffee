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
{ normalizeUuidProp } = require('../utils/normalization')

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
		Use this command to inject a config.json file to the mounted filesystem
		(e.g. SD card or mounted resinOS image) of a provisioned device"

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
		{ runCommand } = require('../utils/helpers')
		umountAsync = Promise.promisify(require('umount').umount)

		Promise.try ->
			return options.drive or visuals.drive('Select the device drive')
		.tap(umountAsync)
		.then (drive) ->
			config.read(drive, options.type).get('uuid')
				.tap ->
					umountAsync(drive)
				.then (uuid) ->
					configureCommand = "os configure #{drive} --device #{uuid}"
					if options.advanced
						configureCommand += ' --advanced'
					return runCommand(configureCommand)
		.then ->
			console.info('Done')
		.nodeify(done)

exports.generate =
	signature: 'config generate'
	description: 'generate a config.json file'
	help: '''
		Use this command to generate a config.json for a device or application.

		Calling this command with the exact version number of the targeted image is required.

		This is interactive by default, but you can do this automatically without interactivity
		by specifying an option for each question on the command line, if you know the questions
		that will be asked for the relevant device type.

		Examples:

			$ resin config generate --device 7cf02a6 --version 2.12.7
			$ resin config generate --device 7cf02a6 --version 2.12.7 --generate-device-api-key
			$ resin config generate --device 7cf02a6 --version 2.12.7 --device-api-key <existingDeviceKey>
			$ resin config generate --device 7cf02a6 --version 2.12.7 --output config.json
			$ resin config generate --app MyApp --version 2.12.7
			$ resin config generate --app MyApp --version 2.12.7 --output config.json
			$ resin config generate --app MyApp --version 2.12.7 \
				--network wifi --wifiSsid mySsid --wifiKey abcdefgh --appUpdatePollInterval 1
	'''
	options: [
		commandOptions.osVersion
		commandOptions.optionalApplication
		commandOptions.optionalDevice
		commandOptions.optionalDeviceApiKey
		{
			signature: 'generate-device-api-key'
			description: 'generate a fresh device key for the device'
			boolean: true
		}
		{
			signature: 'output'
			description: 'output'
			parameter: 'output'
			alias: 'o'
		}
		# Options for non-interactive configuration
		{
			signature: 'network'
			description: 'the network type to use: ethernet or wifi'
			parameter: 'network'
		}
		{
			signature: 'wifiSsid'
			description: 'the wifi ssid to use (used only if --network is set to wifi)'
			parameter: 'wifiSsid'
		}
		{
			signature: 'wifiKey'
			description: 'the wifi key to use (used only if --network is set to wifi)'
			parameter: 'wifiKey'
		}
		{
			signature: 'appUpdatePollInterval'
			description: 'how frequently (in minutes) to poll for application updates'
			parameter: 'appUpdatePollInterval'
		}
	]
	permission: 'user'
	action: (params, options, done) ->
		normalizeUuidProp(options, 'device')
		Promise = require('bluebird')
		writeFileAsync = Promise.promisify(require('fs').writeFile)
		resin = require('resin-sdk').fromSharedOptions()
		form = require('resin-cli-form')
		deviceConfig = require('resin-device-config')
		prettyjson = require('prettyjson')

		{ generateDeviceConfig, generateApplicationConfig } = require('../utils/config')
		{ exitWithExpectedError } = require('../utils/patterns')

		if not options.device? and not options.application?
			exitWithExpectedError '''
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
			.then (formOptions) ->
				# Pass params as an override: if there is any param with exactly the same name as a
				# required option, that value is used (and the corresponding question is not asked)
				form.run(formOptions, override: options)
			.then (answers) ->
				answers.version = options.version

				if resource.uuid?
					generateDeviceConfig(resource, options.deviceApiKey || options['generate-device-api-key'], answers)
				else
					generateApplicationConfig(resource, answers)
		.then (config) ->
			deviceConfig.validate(config)
			if options.output?
				return writeFileAsync(options.output, JSON.stringify(config))

			console.log(prettyjson.render(config))
		.nodeify(done)
