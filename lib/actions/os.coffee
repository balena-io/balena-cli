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

exports.download =
	signature: 'os download <type>'
	description: 'download an unconfigured os image'
	help: '''
		Use this command to download an unconfigured os image for a certain device type.
		If version is not specified the newest stable (non-pre-release) version of OS
		is downloaded if available, or the newest version otherwise (if all existing
		versions for the given device type are pre-release).

		Examples:

			$ resin os download raspberrypi3 -o ../foo/bar/raspberry-pi.img
			$ resin os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version 1.24.1
			$ resin os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version ^1.20.0
			$ resin os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version latest
			$ resin os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version default
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
		{
			signature: 'version'
			description: """
				exact version number, or a valid semver range,
				or 'latest' (includes pre-releases),
				or 'default' (excludes pre-releases if at least one stable version is available),
				or 'recommended' (excludes pre-releases, will fail if only pre-release versions are available)
			"""
			parameter: 'version'
		}
	]
	action: (params, options, done) ->
		unzip = require('unzip2')
		fs = require('fs')
		rindle = require('rindle')
		manager = require('resin-image-manager')
		visuals = require('resin-cli-visuals')

		console.info("Getting device operating system for #{params.type}")

		version = options.version
		if not version
			version = 'default'
			displayVersion = ''
			console.warn('OS version is not specified, using the default version:
				the newest stable (non-pre-release) version if available,
				or the newest version otherwise (if all existing
				versions for the given device type are pre-release)')
		else
			displayVersion = " #{version}"

		manager.get(params.type, version).then (stream) ->
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

stepHandler = (step) ->
	_ = require('lodash')
	rindle = require('rindle')
	visuals = require('resin-cli-visuals')
	helpers = require('../utils/helpers')

	step.on('stdout', _.bind(process.stdout.write, process.stdout))
	step.on('stderr', _.bind(process.stderr.write, process.stderr))

	step.on 'state', (state) ->
		return if state.operation.command is 'burn'
		console.log(helpers.stateToString(state))

	bar = new visuals.Progress('Writing Device OS')

	step.on('burn', _.bind(bar.update, bar))

	return rindle.wait(step)

exports.configure =
	signature: 'os configure <image> <uuid>'
	description: 'configure an os image'
	help: '''
		Use this command to configure a previously download operating system image with a device.

		Examples:

			$ resin os configure ../path/rpi.img 7cf02a6
	'''
	permission: 'user'
	options: [
		signature: 'advanced'
		description: 'show advanced commands'
		boolean: true
		alias: 'v'
	]
	action: (params, options, done) ->
		_ = require('lodash')
		resin = require('resin-sdk-preconfigured')
		form = require('resin-cli-form')
		init = require('resin-device-init')
		helpers = require('../utils/helpers')

		console.info('Configuring operating system image')
		resin.models.device.get(params.uuid).then (device) ->
			helpers.getManifest(params.image, device.device_type)
			.get('options')
			.then (questions) ->

				if not options.advanced
					advancedGroup = _.findWhere questions,
						name: 'advanced'
						isGroup: true

					if advancedGroup?
						override = helpers.getGroupDefaults(advancedGroup)

				return form.run(questions, { override })
			.then (answers) ->
				init.configure(params.image, params.uuid, answers).then(stepHandler)
		.nodeify(done)

exports.initialize =
	signature: 'os initialize <image>'
	description: 'initialize an os image'
	help: '''
		Use this command to initialize a previously configured operating system image.

		Examples:

			$ resin os initialize ../path/rpi.img --type 'raspberry-pi'
	'''
	permission: 'user'
	options: [
		commandOptions.yes
		{
			signature: 'type'
			description: 'device type'
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
	root: true
	action: (params, options, done) ->
		Promise = require('bluebird')
		umount = Promise.promisifyAll(require('umount'))
		form = require('resin-cli-form')
		init = require('resin-device-init')
		patterns = require('../utils/patterns')
		helpers = require('../utils/helpers')

		console.info('Initializing device')
		helpers.getManifest(params.image, options.type)
			.then (manifest) ->
				return manifest.initialization?.options
			.then (questions) ->
				return form.run questions,
					override:
						drive: options.drive
			.tap (answers) ->
				return if not answers.drive?
				message = "This will erase #{answers.drive}. Are you sure?"
				patterns.confirm(options.yes, message)
					.return(answers.drive)
					.then(umount.umountAsync)
			.tap (answers) ->
				return init.initialize(params.image, options.type, answers).then(stepHandler)
			.then (answers) ->
				return if not answers.drive?
				umount.umountAsync(answers.drive).tap ->
					console.info("You can safely remove #{answers.drive} now")
		.nodeify(done)
