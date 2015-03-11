_ = require('lodash-contrib')
path = require('path')
async = require('async')
resin = require('resin-sdk')
visuals = require('resin-cli-visuals')
commandOptions = require('./command-options')
osAction = require('./os')

exports.list =
	signature: 'devices'
	description: 'list all devices'
	help: '''
		Use this command to list all devices that belong to a certain application.

		Examples:

			$ resin devices --application 91
	'''
	options: [ commandOptions.application ]
	permission: 'user'
	action: (params, options, done) ->
		resin.models.device.getAllByApplication options.application, (error, devices) ->
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

			return done()

exports.info =
	signature: 'device <id>'
	description: 'list a single device'
	help: '''
		Use this command to show information about a single device.

		Examples:

			$ resin device 317
	'''
	permission: 'user'
	action: (params, options, done) ->
		resin.models.device.get params.id, (error, device) ->
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
	signature: 'device rm <id>'
	description: 'remove a device'
	help: '''
		Use this command to remove a device from resin.io.

		Notice this command asks for confirmation interactively.
		You can avoid this by passing the `--yes` boolean option.

		Examples:

			$ resin device rm 317
			$ resin device rm 317 --yes
	'''
	options: [ commandOptions.yes ]
	permission: 'user'
	action: (params, options, done) ->
		visuals.patterns.remove 'device', options.yes, (callback) ->
			resin.models.device.remove(params.id, callback)
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
	signature: 'device rename <id> [name]'
	description: 'rename a resin device'
	help: '''
		Use this command to rename a device.

		If you omit the name, you'll get asked for it interactively.

		Examples:

			$ resin device rename 317 MyPi
			$ resin device rename 317
	'''
	permission: 'user'
	action: (params, options, done) ->
		async.waterfall [

			(callback) ->
				if not _.isEmpty(params.name)
					return callback(null, params.name)
				visuals.widgets.ask('How do you want to name this device?', null, callback)

			(name, callback) ->
				resin.models.device.rename(params.id, name, callback)

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

exports.init =
	signature: 'device init [device]'
	description: 'initialise a device with resin os'
	help: '''
		Use this command to download the OS image of a certain application and write it to an SD Card.

		Note that this command requires admin privileges.

		If `device` is omitted, you will be prompted to select a device interactively.

		Notice this command asks for confirmation interactively.
		You can avoid this by passing the `--yes` boolean option.

		You can quiet the progress bar by passing the `--quiet` boolean option.

		You may have to unmount the device before attempting this operation.

		You need to configure the network type and other settings:

		Ethernet:
		  You can setup the device OS to use ethernet by setting the `--network` option to "ethernet".

		Wifi:
		  You can setup the device OS to use wifi by setting the `--network` option to "wifi".
		  If you set "network" to "wifi", you will need to specify the `--ssid` and `--key` option as well.

		You can omit network related options to be asked about them interactively.

		Examples:

			$ resin device init --application 91
			$ resin device init --application 91 --network ethernet
			$ resin device init /dev/disk2 --application 91 --network wifi --ssid MyNetwork --key secret
	'''
	options: [
		commandOptions.application
		commandOptions.network
		commandOptions.wifiSsid
		commandOptions.wifiKey
	]
	permission: 'user'
	action: (params, options, done) ->

		params.id = options.application

		async.waterfall([

			(callback) ->
				return callback(null, params.device) if params.device?
				visuals.patterns.selectDrive(callback)

			(device, callback) ->
				params.device = device
				visuals.patterns.confirm(options.yes, "This will completely erase #{params.device}. Are you sure you want to continue?", callback)

			(confirmed, callback) ->
				return done() if not confirmed
				options.yes = confirmed
				osAction.download.action(params, options, callback)

			(outputFile, callback) ->
				params.image = outputFile
				osAction.install.action(params, options, callback)

		], done)
