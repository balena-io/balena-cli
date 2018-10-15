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
_ = require('lodash')
{ normalizeUuidProp } = require('../utils/normalization')

formatVersion = (v, isRecommended) ->
	result = "v#{v}"
	if isRecommended
		result += ' (recommended)'
	return result

resolveVersion = (deviceType, version) ->
	if version isnt 'menu'
		if version[0] == 'v'
			version = version.slice(1)
		return Promise.resolve(version)

	form = require('resin-cli-form')
	resin = require('resin-sdk').fromSharedOptions()

	resin.models.os.getSupportedVersions(deviceType)
	.then ({ versions, recommended }) ->
		choices = versions.map (v) ->
			value: v
			name: formatVersion(v, v is recommended)

		return form.ask
			message: 'Select the OS version:'
			type: 'list'
			choices: choices
			default: recommended

exports.versions =
	signature: 'os versions <type>'
	description: 'show the available resinOS versions for the given device type'
	help: '''
		Use this command to show the available resinOS versions for a certain device type.
		Check available types with `resin devices supported`

		Example:

			$ resin os versions raspberrypi3
	'''
	action: (params, options, done) ->
		resin = require('resin-sdk').fromSharedOptions()

		resin.models.os.getSupportedVersions(params.type)
		.then ({ versions, recommended }) ->
			versions.forEach (v) ->
				console.log(formatVersion(v, v is recommended))

exports.download =
	signature: 'os download <type>'
	description: 'download an unconfigured os image'
	help: '''
		Use this command to download an unconfigured os image for a certain device type.
		Check available types with `resin devices supported`

		If version is not specified the newest stable (non-pre-release) version of OS
		is downloaded if available, or the newest version otherwise (if all existing
		versions for the given device type are pre-release).

		You can pass `--version menu` to pick the OS version from the interactive menu
		of all available versions.

		Examples:

			$ resin os download raspberrypi3 -o ../foo/bar/raspberry-pi.img
			$ resin os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version 1.24.1
			$ resin os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version ^1.20.0
			$ resin os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version latest
			$ resin os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version default
			$ resin os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version menu
	'''
	permission: 'user'
	options: [
		{
			signature: 'output'
			description: 'output path'
			parameter: 'output'
			alias: 'o'
			required: 'You have to specify the output location'
		}
		commandOptions.osVersionOrSemver
	]
	action: (params, options, done) ->
		Promise = require('bluebird')
		unzip = require('unzip2')
		fs = require('fs')
		rindle = require('rindle')
		manager = require('resin-image-manager')
		visuals = require('resin-cli-visuals')

		console.info("Getting device operating system for #{params.type}")

		displayVersion = ''
		Promise.try ->
			if not options.version
				console.warn('OS version is not specified, using the default version:
					the newest stable (non-pre-release) version if available,
					or the newest version otherwise (if all existing
					versions for the given device type are pre-release).')
				return 'default'
			return resolveVersion(params.type, options.version)
		.then (version) ->
			if version isnt 'default'
				displayVersion = " #{version}"
			return manager.get(params.type, version)
		.then (stream) ->
			bar = new visuals.Progress("Downloading Device OS#{displayVersion}")
			spinner = new visuals.Spinner("Downloading Device OS#{displayVersion} (size unknown)")

			stream.on 'progress', (state) ->
				if state?
					bar.update(state)
				else
					spinner.start()

			stream.on 'end', ->
				spinner.stop()

			# We completely rely on the `mime` custom property
			# to make this decision.
			# The actual stream should be checked instead.
			if stream.mime is 'application/zip'
				output = unzip.Extract(path: options.output)
			else
				output = fs.createWriteStream(options.output)

			return rindle.wait(stream.pipe(output)).return(options.output)
		.tap (output) ->
			console.info('The image was downloaded successfully')
		.nodeify(done)

buildConfig = (image, deviceType, advanced = false) ->
	form = require('resin-cli-form')
	helpers = require('../utils/helpers')

	helpers.getManifest(image, deviceType)
	.get('options')
	.then (questions) ->
		if not advanced
			advancedGroup = _.find questions,
				name: 'advanced'
				isGroup: true

			if advancedGroup?
				override = helpers.getGroupDefaults(advancedGroup)

		return form.run(questions, { override })

exports.buildConfig =
	signature: 'os build-config <image> <device-type>'
	description: 'build the OS config and save it to the JSON file'
	help: '''
		Use this command to prebuild the OS config once and skip the interactive part of `resin os configure`.

		Example:

			$ resin os build-config ../path/rpi3.img raspberrypi3 --output rpi3-config.json
			$ resin os configure ../path/rpi3.img 7cf02a6 --config "$(cat rpi3-config.json)"
	'''
	permission: 'user'
	options: [
		commandOptions.advancedConfig
		{
			signature: 'output'
			description: 'the path to the output JSON file'
			alias: 'o'
			required: 'the output path is required'
			parameter: 'output'
		}
	]
	action: (params, options, done) ->
		fs = require('fs')
		Promise = require('bluebird')
		writeFileAsync = Promise.promisify(fs.writeFile)

		buildConfig(params.image, params['device-type'], options.advanced)
		.then (answers) ->
			writeFileAsync(options.output, JSON.stringify(answers, null, 4))
		.nodeify(done)

exports.configure =
	signature: 'os configure <image>'
	description: 'configure an os image'
	help: '''
		Use this command to configure a previously downloaded operating system image for
		the specific device or for an application generally.

		Calling this command with the exact version number of the targeted image is required.

		Note that device api keys are only supported on ResinOS 2.0.3+.

		This command still supports the *deprecated* format where the UUID and optionally device key
		are passed directly on the command line, but the recommended way is to pass either an --app or
		--device argument. The deprecated format will be remove in a future release.

		Examples:

			$ resin os configure ../path/rpi.img --device 7cf02a6 --version 2.12.7
			$ resin os configure ../path/rpi.img --device 7cf02a6 --version 2.12.7 --device-api-key <existingDeviceKey>
			$ resin os configure ../path/rpi.img --app MyApp  --version 2.12.7
	'''
	permission: 'user'
	options: [
		commandOptions.advancedConfig
		commandOptions.optionalApplication
		commandOptions.optionalDevice
		commandOptions.optionalDeviceApiKey
		commandOptions.osVersion
		{
			signature: 'config'
			description: 'path to the config JSON file, see `resin os build-config`'
			parameter: 'config'
		}
	]
	action: (params, options, done) ->
		normalizeUuidProp(options, 'device')
		fs = require('fs')
		Promise = require('bluebird')
		readFileAsync = Promise.promisify(fs.readFile)
		resin = require('resin-sdk').fromSharedOptions()
		init = require('resin-device-init')
		helpers = require('../utils/helpers')
		patterns = require('../utils/patterns')
		{ generateDeviceConfig, generateApplicationConfig } = require('../utils/config')

		if _.filter([
			options.device
			options.application
		]).length != 1
			patterns.exitWithExpectedError '''
				To configure an image, you must provide exactly one of:

				* A device, with --device <uuid>
				* An application, with --app <appname>

				See the help page for examples:

				  $ resin help os configure
			'''

		uuid = options.device
		deviceApiKey = options.deviceApiKey

		console.info('Configuring operating system image')

		configurationResourceType = if uuid then 'device' else 'application'

		resin.models[configurationResourceType].get(uuid || options.application)
		.then (appOrDevice) ->
			Promise.try ->
				if options.config
					return readFileAsync(options.config, 'utf8')
						.then(JSON.parse)
				return buildConfig(params.image, appOrDevice.device_type, options.advanced)
			.then (answers) ->
				answers.version = options.version

				(if configurationResourceType == 'device'
					generateDeviceConfig(appOrDevice, deviceApiKey, answers)
				else
					generateApplicationConfig(appOrDevice, answers)
				).then (config) ->
					init.configure(params.image, appOrDevice.device_type, config, answers)
		.then(helpers.osProgressHandler)
		.nodeify(done)

INIT_WARNING_MESSAGE = '''
	Note: Initializing the device may ask for administrative permissions
	because we need to access the raw devices directly.
'''

exports.initialize =
	signature: 'os initialize <image>'
	description: 'initialize an os image'
	help: """
		Use this command to initialize a device with previously configured operating system image.

		#{INIT_WARNING_MESSAGE}

		Examples:

			$ resin os initialize ../path/rpi.img --type 'raspberry-pi'
	"""
	permission: 'user'
	options: [
		commandOptions.yes
		{
			signature: 'type'
			description: 'device type (Check available types with `resin devices supported`)'
			parameter: 'type'
			alias: 't'
			required: 'You have to specify a device type'
		}
		commandOptions.drive
	]
	action: (params, options, done) ->
		Promise = require('bluebird')
		umountAsync = Promise.promisify(require('umount').umount)
		form = require('resin-cli-form')
		patterns = require('../utils/patterns')
		helpers = require('../utils/helpers')

		console.info("""
			Initializing device

			#{INIT_WARNING_MESSAGE}
		""")
		helpers.getManifest(params.image, options.type)
			.then (manifest) ->
				return manifest.initialization?.options
			.then (questions) ->
				return form.run questions,
					override:
						drive: options.drive
			.tap (answers) ->
				return if not answers.drive?
				patterns.confirm(
					options.yes
					"This will erase #{answers.drive}. Are you sure?"
					"Going to erase #{answers.drive}."
				)
					.return(answers.drive)
					.then(umountAsync)
			.tap (answers) ->
				return helpers.sudo([
					'internal'
					'osinit'
					params.image
					options.type
					JSON.stringify(answers)
				])
			.then (answers) ->
				return if not answers.drive?

				# TODO: resin local makes use of ejectAsync, see below
				# DO we need this / should we do that here?

				# getDrive = (drive) ->
				# 	driveListAsync().then (drives) ->
				# 		selectedDrive = _.find(drives, device: drive)

				# 		if not selectedDrive?
				# 			throw new Error("Drive not found: #{drive}")

				# 		return selectedDrive
				# if (os.platform() is 'win32') and selectedDrive.mountpoint?
				# 	ejectAsync = Promise.promisify(require('removedrive').eject)
				# 	return ejectAsync(selectedDrive.mountpoint)

				umountAsync(answers.drive).tap ->
					console.info("You can safely remove #{answers.drive} now")
		.nodeify(done)
