Promise = require('bluebird')
capitano = require('capitano')
_ = require('lodash')
async = require('async')
resin = require('resin-sdk')
visuals = require('resin-cli-visuals')
vcs = require('resin-vcs')
manager = require('resin-image-manager')
image = require('resin-image')
inject = require('resin-config-inject')
registerDevice = require('resin-register-device')
pine = require('resin-pine')
deviceConfig = require('resin-device-config')
form = require('resin-cli-form')
htmlToText = require('html-to-text')
helpers = require('../utils/helpers')

commandOptions = require('./command-options')

exports.list =
	signature: 'devices'
	description: 'list all devices'
	help: '''
		Use this command to list all devices that belong to you.

		You can filter the devices by application by using the `--application` option.

		Examples:

			$ resin devices
			$ resin devices --application MyApp
			$ resin devices --app MyApp
			$ resin devices -a MyApp
	'''
	options: [ commandOptions.optionalApplication ]
	permission: 'user'
	action: (params, options, done) ->
		Promise.try ->
			if options.application?
				return resin.models.device.getAllByApplication(options.application)
			return resin.models.device.getAll()

		.tap (devices) ->
			console.log visuals.table.horizontal devices, [
				'id'
				'name'
				'device_type'
				'is_online'
				'application_name'
				'status'
				'last_seen'
			]
		.nodeify(done)

exports.info =
	signature: 'device <uuid>'
	description: 'list a single device'
	help: '''
		Use this command to show information about a single device.

		Examples:

			$ resin device 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9
	'''
	permission: 'user'
	action: (params, options, done) ->
		resin.models.device.get(params.uuid).then (device) ->

			# TODO: We should outsource this logic and probably
			# other last_seen edge cases to either Resin CLI Visuals
			# or have it parsed appropriately in the SDK.
			device.last_seen ?= 'Not seen'

			console.log visuals.table.vertical device, [
				"$#{device.name}$"
				'id'
				'device_type'
				'is_online'
				'ip_address'
				'application_name'
				'status'
				'last_seen'
				'uuid'
				'commit'
				'supervisor_version'
				'is_web_accessible'
				'note'
			]
		.nodeify(done)

exports.remove =
	signature: 'device rm <uuid>'
	description: 'remove a device'
	help: '''
		Use this command to remove a device from resin.io.

		Notice this command asks for confirmation interactively.
		You can avoid this by passing the `--yes` boolean option.

		Examples:

			$ resin device rm 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9
			$ resin device rm 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9 --yes
	'''
	options: [ commandOptions.yes ]
	permission: 'user'
	action: (params, options, done) ->
		helpers.confirm(options.yes, 'Are you sure you want to delete the device?').then (confirmed) ->
			return if not confirmed
			resin.models.device.remove(params.uuid)
		.nodeify(done)

exports.identify =
	signature: 'device identify <uuid>'
	description: 'identify a device with a UUID'
	help: '''
		Use this command to identify a device.

		In the Raspberry Pi, the ACT led is blinked several times.

		Examples:

			$ resin device identify 23c73a12e3527df55c60b9ce647640c1b7da1b32d71e6a39849ac0f00db828
	'''
	permission: 'user'
	action: (params, options, done) ->
		resin.models.device.identify(params.uuid).nodeify(done)

exports.rename =
	signature: 'device rename <uuid> [newName]'
	description: 'rename a resin device'
	help: '''
		Use this command to rename a device.

		If you omit the name, you'll get asked for it interactively.

		Examples:

			$ resin device rename 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9 MyPi
			$ resin device rename 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9
	'''
	permission: 'user'
	action: (params, options, done) ->
		Promise.try ->
			return params.newName if not _.isEmpty(params.newName)

			form.ask
				message: 'How do you want to name this device?'
				type: 'input'

		.then(_.partial(resin.models.device.rename, params.uuid))
		.nodeify(done)

exports.await =
	signature: 'device await <uuid>'
	description: 'await for a device to become online'
	help: '''
		Use this command to await for a device to become online.

		The process will exit when the device becomes online.

		Notice that there is no time limit for this command, so it might run forever.

		You can configure the poll interval with the --interval option (defaults to 3000ms).

		Examples:

			$ resin device await 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9
			$ resin device await 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9 --interval 1000
	'''
	options: [
		signature: 'interval'
		parameter: 'interval'
		description: 'poll interval'
		alias: 'i'
	]
	permission: 'user'
	action: (params, options, done) ->
		options.interval ?= 3000

		spinner = new visuals.Spinner("Awaiting device: #{params.uuid}")

		poll = ->
			resin.models.device.isOnline(params.uuid).then (isOnline) ->
				if isOnline
					spinner.stop()
					console.info("Device became online: #{params.uuid}")
					return
				else

					# Spinner implementation is smart enough to
					# not start again if it was already started
					spinner.start()

					return Promise.delay(options.interval).then(poll)
		poll().nodeify(done)

exports.init =
	signature: 'device init [device]'
	description: 'initialise a device with resin os'
	help: '''
		Use this command to download the OS image of a certain application and write it to an SD Card.

		Note that this command requires admin privileges.

		If `device` is omitted, you will be prompted to select a device interactively.

		Notice this command asks for confirmation interactively.
		You can avoid this by passing the `--yes` boolean option.

		You can quiet the progress bar and other logging information by passing the `--quiet` boolean option.

		You need to configure the network type and other settings:

		Ethernet:
		  You can setup the device OS to use ethernet by setting the `--network` option to "ethernet".

		Wifi:
		  You can setup the device OS to use wifi by setting the `--network` option to "wifi".
		  If you set "network" to "wifi", you will need to specify the `--ssid` and `--key` option as well.

		You can omit network related options to be asked about them interactively.

		Examples:

			$ resin device init
			$ resin device init --application MyApp
			$ resin device init --application MyApp --network ethernet
			$ resin device init /dev/disk2 --application MyApp --network wifi --ssid MyNetwork --key secret
	'''
	options: [
		commandOptions.optionalApplication
		commandOptions.network
		commandOptions.wifiSsid
		commandOptions.wifiKey
	]
	permission: 'user'
	root: true
	action: (params, options, done) ->

		networkOptions =
			network: options.network
			wifiSsid: options.ssid
			wifiKey: options.key

		async.waterfall [

			(callback) ->
				return callback(null, options.application) if options.application?
				vcs.getApplicationName(process.cwd()).nodeify(callback)

			(applicationName, callback) ->
				options.application = applicationName
				resin.models.application.has(options.application).nodeify(callback)

			(hasApplication, callback) ->
				if not hasApplication
					return callback(new Error("Invalid application: #{options.application}"))

				return callback(null, params.device) if params.device?
				visuals.drive().nodeify(callback)

			(device, callback) ->
				params.device = device
				message = "This will completely erase #{params.device}. Are you sure you want to continue?"
				if options.yes
					return callback(null, true)
				else
					form.ask
						message: message
						type: 'confirm'
						default: false
					.nodeify(callback)

			(confirmed, callback) ->
				return done() if not confirmed
				return callback() if networkOptions.network?
				form.run [
					message: 'Network Type'
					name: 'network'
					type: 'list'
					choices: [ 'ethernet', 'wifi' ]
				,
					message: 'Wifi Ssid'
					name: 'wifiSsid'
					type: 'input'
					when:
						network: 'wifi'
				,
					message: 'Wifi Key'
					name: 'wifiKey'
					type: 'input'
					when:
						network: 'wifi'
				]
				.then (parameters) ->
					_.extend(networkOptions, parameters)
				.nodeify(callback)

			(callback) ->
				console.info("Checking application: #{options.application}")
				resin.models.application.get(options.application).nodeify(callback)

			(application, callback) ->
				async.parallel

					manifest: (callback) ->
						console.info('Getting device manifest for the application')
						resin.models.device.getManifestBySlug(application.device_type).nodeify(callback)

					config: (callback) ->
						console.info('Fetching application configuration')
						deviceConfig.get(options.application, networkOptions).nodeify(callback)

				, callback

			(results, callback) ->
				params.manifest = results.manifest
				console.info('Associating the device')

				registerDevice.register pine, results.config, (error, device) ->
					return callback(error) if error?

					# Associate a device
					results.config.deviceId = device.id
					results.config.uuid = device.uuid
					results.config.registered_at = Math.floor(Date.now() / 1000)

					params.uuid = results.config.uuid

					return callback(null, results)

			(results, callback) ->
				console.info('Initializing device operating system image')
				console.info('This may take a few minutes')

				if process.env.DEBUG
					console.log(results.config)

				bar = new visuals.Progress('Downloading Device OS')
				spinner = new visuals.Spinner('Downloading Device OS (size unknown)')

				manager.configure params.manifest, results.config, (error, imagePath, removeCallback) ->
					spinner.stop()
					return callback(error, imagePath, removeCallback)
				, (state) ->
					if state?
						bar.update(state)
					else
						spinner.start()

			(configuredImagePath, removeCallback, callback) ->
				console.info('The base image was cached to improve initialization time of similar devices')

				console.info('Attempting to write operating system image to drive')

				bar = new visuals.Progress('Writing Device OS')
				image.write
					device: params.device
					image: configuredImagePath
					progress: _.bind(bar.update, bar)
				, (error) ->
					return callback(error) if error?
					return callback(null, configuredImagePath, removeCallback)

			(temporalImagePath, removeCallback, callback) ->
				console.info('Image written successfully')
				removeCallback(callback)

			(callback) ->
				resin.models.device.get(params.uuid).nodeify(callback)

			(device, callback) ->
				console.info("Device created: #{device.name}")
				return callback(null, params.uuid)

		], done
