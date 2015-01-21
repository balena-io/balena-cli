_ = require('lodash-contrib')
async = require('async')
resin = require('resin-sdk')
os = require('os')
fs = require('fs')
progressStream = require('progress-stream')
visuals = require('resin-cli-visuals')
commandOptions = require('./command-options')

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
				'ID'
				'Name'
				'Device Display Name'
				'Is Online'
				'Application Name'
				'Status'
				'Last Seen'
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
				'ID'
				'Name'
				'Device Display Name'
				'Is Online'
				'IP Address'
				'Application Name'
				'Status'
				'Last Seen'
				'UUID'
				'Commit'
				'Supervisor Version'
				'Is Web Accessible'
				'Note'
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
				visuals.widgets.ask('How do you want to name this device?', callback)

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
	action: ->
		devices = resin.models.device.getSupportedDeviceTypes()
		_.each(devices, _.unary(console.log))

exports.init =
	signature: 'device init <image> <device>'
	description: 'write an operating system image to a device'
	help: '''
		Use this command to write an operating system image to a device.

		Note that this command requires admin privileges.

		Notice this command asks for confirmation interactively.
		You can avoid this by passing the `--yes` boolean option.

		You can quiet the progress bar by passing the `--quiet` boolean option.

		You may have to unmount the device before attempting this operation.

		In Mac OS X:
			$ sudo diskutil unmountDisk /dev/xxx

		In GNU/Linux:
			$ sudo umount /dev/xxx

		Examples:
			$ resin device init rpi.iso /dev/disk2
	'''
	options: [ commandOptions.yes ]
	permission: 'user'
	action: (params, options, done) ->
		if os.platform() is 'win32'
			error = new Error('This functionality is only available on UNIX based systems for now.')
			return done(error)

		if not fs.existsSync(params.image)
			error = new Error("Invalid OS image: #{params.image}")
			return done(error)

		if not fs.existsSync(params.device)
			error = new Error("Invalid device: #{params.device}")
			return done(error)

		async.waterfall([

			(callback) ->
				if options.yes
					return callback(null, true)
				else
					confirmMessage = "This will completely erase #{params.device}. Are you sure you want to continue?"
					visuals.widgets.confirm(confirmMessage, callback)

			(confirmed, callback) ->
				return done() if not confirmed

				imageFile = fs.createReadStream(params.image)
				deviceFile = fs.createWriteStream(params.device)
				imageFileSize = fs.statSync(params.image).size

				progress = progressStream
					length: imageFileSize
					time: 500

				if not options.quiet
					progressBar = new visuals.widgets.Progress('Writing device OS', imageFileSize)
					progress.on 'progress', (status) ->
						progressBar.tick(status.delta)

				imageFile
					.pipe(progress)
					.pipe(deviceFile)
					.on 'error', (error) ->
						if error.code is 'EBUSY'
							error.message = "Try umounting #{error.path} first."
						return callback(error)
					.on('close', callback)

		], done)

