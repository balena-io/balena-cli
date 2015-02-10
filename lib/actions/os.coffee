_ = require('lodash-contrib')
fs = require('fs')
os = require('os')
async = require('async')
path = require('path')
mkdirp = require('mkdirp')
resin = require('resin-sdk')
visuals = require('resin-cli-visuals')
progressStream = require('progress-stream')
diskio = require('diskio')
commandOptions = require('./command-options')

exports.download =
	signature: 'os download <id>'
	description: 'download device OS'
	help: '''
		Use this command to download the device OS configured to a specific network.

		Ethernet:
			You can setup the device OS to use ethernet by setting the `--network` option to "ethernet".

		Wifi:
			You can setup the device OS to use wifi by setting the `--network` option to "wifi".
			If you set "network" to "wifi", you will need to specify the `--ssid` and `--key` option as well.

		By default, this command saved the downloaded image into a resin specific directory.
		You can save it to a custom location by specifying the `--output` option.

		Examples:
			$ resin os download 91 --network ethernet
			$ resin os download 91 --network wifi --ssid MyNetwork --key secreykey123
			$ resin os download 91 --network ethernet --output ~/MyResinOS.zip
	'''
	options: [
		commandOptions.network
		commandOptions.wifiSsid
		commandOptions.wifiKey

		{
			signature: 'output'
			parameter: 'output'
			description: 'output file'
			alias: 'o'
		}
	]
	permission: 'user'
	action: (params, options, done) ->
		osParams =
			network: options.network
			wifiSsid: options.ssid
			wifiKey: options.key
			appId: params.id

		fileName = resin.models.os.generateCacheName(osParams)
		options.output ?= path.join(resin.settings.get('directories.os'), fileName)

		async.waterfall [

			(callback) ->

				# We need to ensure this directory exists
				mkdirp(path.dirname(options.output), _.unary(callback))

			(callback) ->
				console.info("Destination file: #{options.output}\n")

				bar = new visuals.widgets.Progress('Downloading Device OS')

				resin.models.os.download osParams, options.output, callback, (state) ->
					bar.update(state)

		], (error) ->
			return done(error) if error?
			console.info("\nFinished downloading #{options.output}")
			return done(null, options.output)

exports.install =
	signature: 'os install <image> [device]'
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
			$ resin os install rpi.iso /dev/disk2
	'''
	options: [ commandOptions.yes ]
	permission: 'user'
	action: (params, options, done) ->
		async.waterfall [

			(callback) ->
				return callback(null, params.device) if params.device?
				visuals.patterns.selectDrive(callback)

			(device, callback) ->
				params.device = device
				message = "This will completely erase #{params.device}. Are you sure you want to continue?"
				visuals.patterns.confirm(options.yes, message, callback)

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
						bar.update(status)

				imageFileStream = fs.createReadStream(params.image).pipe(progress)

				diskio.writeStream(params.device, imageFileStream, callback)

		], (error) ->
			if os.platform() is 'win32' and error? and (error.code is 'EPERM' or error.code is 'EACCES')
				windosu = require('windosu')

				# Need to escape every path to avoid errors
				resinWritePath = "\"#{path.join(__dirname, '..', '..', 'bin', 'resin-write')}\""
				windosu.exec("node #{resinWritePath} \"#{params.image}\" \"#{params.device}\"")
			else
				return done(error)
