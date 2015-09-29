Promise = require('bluebird')
capitano = Promise.promisifyAll(require('capitano'))
_ = require('lodash')
resin = require('resin-sdk')
visuals = require('resin-cli-visuals')
form = require('resin-cli-form')
events = require('resin-cli-events')
rimraf = Promise.promisify(require('rimraf'))
patterns = require('../utils/patterns')
tmp = Promise.promisifyAll(require('tmp'))
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
			events.send('device.open', device: device.uuid)
		.nodeify(done)

exports.register =
	signature: 'device register <application>'
	description: 'register a device'
	help: '''
		Use this command to register a device to an application.

		Examples:

			$ resin device register MyApp
	'''
	permission: 'user'
	action: (params, options, done) ->
		resin.models.application.get(params.application).then (application) ->
			uuid = resin.models.device.generateUUID()
			console.info("Registering to #{application.app_name}: #{uuid}")
			return resin.models.device.register(application.app_name, uuid)
		.get('uuid')
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
		patterns.confirm(options.yes, 'Are you sure you want to delete the device?').then ->
			resin.models.device.remove(params.uuid)
		.tap ->
			events.send('device.delete', device: params.uuid)
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
		.tap ->
			events.send('device.rename', device: params.uuid)
		.nodeify(done)

exports.init =
	signature: 'device init'
	description: 'initialise a device with resin os'
	help: '''
		Use this command to download the OS image of a certain application and write it to an SD Card.

		Notice this command may ask for confirmation interactively.
		You can avoid this by passing the `--yes` boolean option.

		Examples:

			$ resin device init
			$ resin device init --application MyApp
	'''
	options: [
		commandOptions.optionalApplication
		commandOptions.yes
	]
	permission: 'user'
	root: true
	action: (params, options, done) ->
		Promise.try ->
			return options.application if options.application?
			return patterns.selectApplication()
		.then(resin.models.application.get)
		.then (application) ->

			download = ->
				tmp.tmpNameAsync().then (temporalPath) ->
					capitano.runAsync("os download --output #{temporalPath}")
				.disposer(_.ary(rimraf, 1))

			Promise.using(download()).then (temporalPath) ->
				capitano.runAsync("device register #{application.app_name}")
					.then(resin.models.device.get)
					.tap (device) ->
						capitano.runAsync("os configure #{temporalPath} #{device.uuid}").then ->
							capitano.runAsync("os initialize #{temporalPath} #{device.uuid}")
					.then (device) ->
						console.log('Done')
						return device.uuid

		.nodeify(done)
