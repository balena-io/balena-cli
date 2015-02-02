_ = require('lodash-contrib')
path = require('path')
async = require('async')
resin = require('resin-sdk')
os = require('os')
visuals = require('resin-cli-visuals')
fs = require('fs')
progressStream = require('progress-stream')
drivelist = require('drivelist')
diskio = require('diskio')
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
	signature: 'device init <image> [device]'
	description: 'write an operating system image to a device'
	help: '''
		Use this command to write an operating system image to a device.

		Note that this command requires admin privileges.

		If `device` is omitted, you will be prompted to select a device interactively.

		Notice this command asks for confirmation interactively.
		You can avoid this by passing the `--yes` boolean option.

		You can quiet the progress bar by passing the `--quiet` boolean option.

		You may have to unmount the device before attempting this operation.

		See the `drives` command to get a list of all connected devices to your machine and their respective ids.

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
		async.waterfall [

			(callback) ->
				return callback(null, params.device) if params.device?

				drivelist.list (error, drives) ->
					return callback(error) if error?

					drives = _.map drives, (item) ->
						return {
							name: "#{item.device} (#{item.size}) - #{item.description}"
							value: item.device
						}

					visuals.widgets.select('Select a drive', drives, callback)

			(device, callback) ->
				params.device = device

				if options.yes
					return callback(null, true)
				else
					confirmMessage = "This will completely erase #{params.device}. Are you sure you want to continue?"
					visuals.widgets.confirm(confirmMessage, callback)

			(confirmed, callback) ->
				return done() if not confirmed

				imageFileSize = fs.statSync(params.image).size

				if imageFileSize is 0
					error = new Error("Invalid OS image: #{params.image}. The image is 0 bytes.")
					return callback(error)

				progress = progressStream
					length: imageFileSize
					time: 500

				if not options.quiet
					bar = new visuals.widgets.Progress('Writing Device OS')

					progress.on 'progress', (status) ->
						console.log(bar.tick(status.percentage, status.eta))

				imageFileStream = fs.createReadStream(params.image).pipe(progress)

				diskio.writeStream(params.device, imageFileStream, callback)

		], (error) ->
			if os.platform() is 'win32' and error? and (error.code is 'EPERM' or error.code is 'EACCES')
				windosu = require('windosu')

				# Need to escape everypath to avoid errors
				resinWritePath = "\"#{path.join(__dirname, '..', '..', 'bin', 'resin-write')}\""
				windosu.exec("node #{resinWritePath} \"#{params.image}\" \"#{params.device}\"")
			else
				return done(error)
