fse = require('fs-extra')
capitano = require('capitano')
_ = require('lodash-contrib')
path = require('path')
async = require('async')
resin = require('resin-sdk')
visuals = require('resin-cli-visuals')
vcs = require('resin-vcs')
manager = require('resin-image-manager')
image = require('resin-image')
inject = require('resin-config-inject')
registerDevice = require('resin-register-device')
pine = require('resin-pine')
tmp = require('tmp')

# Cleanup the temporary files even when an uncaught exception occurs
tmp.setGracefulCleanup()

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

		if options.application?
			getFunction = _.partial(resin.models.device.getAllByApplication, options.application)
		else
			getFunction = resin.models.device.getAll

		getFunction (error, devices) ->
			return done(error) if error?
			console.log visuals.widgets.table.horizontal devices, [
				'id'
				'name'
				'device_type'
				'is_online'
				'application_name'
				'status'
				'last_seen'
			]

			return done(null, devices)

exports.info =
	signature: 'device <name>'
	description: 'list a single device'
	help: '''
		Use this command to show information about a single device.

		Examples:

			$ resin device MyDevice
	'''
	permission: 'user'
	action: (params, options, done) ->
		resin.models.device.get params.name, (error, device) ->
			return done(error) if error?
			console.log visuals.widgets.table.vertical device, [
				'id'
				'name'
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

			return done()

exports.remove =
	signature: 'device rm <name>'
	description: 'remove a device'
	help: '''
		Use this command to remove a device from resin.io.

		Notice this command asks for confirmation interactively.
		You can avoid this by passing the `--yes` boolean option.

		Examples:

			$ resin device rm MyDevice
			$ resin device rm MyDevice --yes
	'''
	options: [ commandOptions.yes ]
	permission: 'user'
	action: (params, options, done) ->
		visuals.patterns.remove 'device', options.yes, (callback) ->
			resin.models.device.remove(params.name, callback)
		, done

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
		resin.models.device.identify(params.uuid, done)

exports.rename =
	signature: 'device rename <name> [newName]'
	description: 'rename a resin device'
	help: '''
		Use this command to rename a device.

		If you omit the name, you'll get asked for it interactively.

		Examples:

			$ resin device rename MyDevice MyPi
			$ resin device rename MyDevice
	'''
	permission: 'user'
	action: (params, options, done) ->
		async.waterfall [

			(callback) ->
				if not _.isEmpty(params.newName)
					return callback(null, params.newName)
				visuals.widgets.ask('How do you want to name this device?', null, callback)

			(newName, callback) ->
				resin.models.device.rename(params.name, newName, callback)

		], done

exports.supported =
	signature: 'devices supported'
	description: 'list all supported devices'
	help: '''
		Use this command to get the list of all supported devices

		Examples:

			$ resin devices supported
	'''
	permission: 'user'
	action: (params, options, done) ->
		resin.models.device.getSupportedDeviceTypes (error, devices) ->
			return done(error) if error?
			_.each(devices, _.unary(console.log))
			done()

exports.await =
	signature: 'device await <name>'
	description: 'await for a device to become online'
	help: '''
		Use this command to await for a device to become online.

		The process will exit when the device becomes online.

		Notice that there is no time limit for this command, so it might run forever.

		You can configure the poll interval with the --interval option (defaults to 3000ms).

		Examples:

			$ resin device await MyDevice
			$ resin device await MyDevice --interval 1000
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

		poll = ->
			resin.models.device.isOnline params.name, (error, isOnline) ->
				return done(error) if error?

				if isOnline
					console.info("Device became online: #{params.name}")
					return done()
				else
					console.info("Polling device network status: #{params.name}")
					setTimeout(poll, options.interval)

		poll()

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

		async.waterfall([

			(callback) ->
				return callback(null, options.application) if options.application?
				vcs.getApplicationName(process.cwd(), callback)

			(applicationName, callback) ->
				options.application = applicationName
				return callback(null, params.device) if params.device?
				visuals.patterns.selectDrive(callback)

			(device, callback) ->
				params.device = device
				message = "This will completely erase #{params.device}. Are you sure you want to continue?"
				visuals.patterns.confirm(options.yes, message, callback)

			(confirmed, callback) ->
				return done() if not confirmed
				return callback() if networkOptions.network?
				visuals.patterns.selectNetworkParameters (error, parameters) ->
					return callback(error) if error?
					_.extend(networkOptions, parameters)
					return callback()

			(callback) ->
				console.info("Checking application: #{options.application}")
				resin.models.application.get(options.application, callback)

			(application, callback) ->
				async.parallel

					manifest: (callback) ->
						console.info('Getting device manifest for the application')
						resin.models.device.getManifestBySlug(application.device_type, callback)

					config: (callback) ->
						console.info('Fetching application configuration')
						resin.models.application.getConfiguration(options.application, networkOptions, callback)

				, callback

			(results, callback) ->
				console.info('Associating the device')

				registerDevice.register pine, results.config, (error, device) ->
					return callback(error) if error?

					# Associate a device
					results.config.deviceId = device.id
					results.config.uuid = device.uuid

					params.uuid = results.config.uuid

					return callback(null, results)

			(results, callback) ->
				console.info('Configuring device operating system image')

				if process.env.DEBUG
					console.log(results.config)

				bar = new visuals.widgets.Progress('Downloading Device OS')
				spinner = new visuals.widgets.Spinner('Downloading Device OS (size unknown)')

				manager.configure results.manifest, results.config, (error, imagePath, removeCallback) ->
					spinner.stop()
					return callback(error, imagePath, removeCallback)
				, (state) ->
					if state?
						bar.update(state)
					else
						spinner.start()

			(configuredImagePath, removeCallback, callback) ->
				console.info('Attempting to write operating system image to drive')

				bar = new visuals.widgets.Progress('Writing Device OS')
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
				resin.models.device.getByUUID(params.uuid, callback)

			(device, callback) ->
				console.info("Device created: #{device.name}")
				return callback(null, device.name)

		], done)
