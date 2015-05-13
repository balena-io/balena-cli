capitano = require('capitano')
_ = require('lodash-contrib')
os = require('os')
async = require('async')
path = require('path')
mkdirp = require('mkdirp')
resin = require('resin-sdk')
image = require('resin-image')
visuals = require('resin-cli-visuals')
selfupdate = require('selfupdate')
commandOptions = require('./command-options')
packageJSON = require('../../package.json')
elevate = require('../elevate')

exports.download =
	signature: 'os download <name>'
	description: 'download device OS'
	help: '''
		Use this command to download the device OS configured to a specific network.

		Ethernet:
			You can setup the device OS to use ethernet by setting the `--network` option to "ethernet".

		Wifi:
			You can setup the device OS to use wifi by setting the `--network` option to "wifi".
			If you set "network" to "wifi", you will need to specify the `--ssid` and `--key` option as well.

		Alternatively, you can omit all kind of network configuration options to configure interactively.

		You have to specify an output location with the `--output` option.

		Examples:

			$ resin os download MyApp --output ~/MyResinOS.zip
			$ resin os download MyApp --network ethernet --output ~/MyResinOS.zip
			$ resin os download MyApp --network wifi --ssid MyNetwork --key secreykey123 --output ~/MyResinOS.zip
			$ resin os download MyApp --network ethernet --output ~/MyResinOS.zip
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
			required: 'You need to specify an output file'
		}
	]
	permission: 'user'
	action: (params, options, done) ->
		resin.models.application.get params.name, (error, application) ->
			return done(error) if error?

			osParams =
				network: options.network
				wifiSsid: options.ssid
				wifiKey: options.key
				appId: application.id

			async.waterfall [

				(callback) ->
					return callback() if osParams.network?
					visuals.patterns.selectNetworkParameters (error, parameters) ->
						return callback(error) if error?
						_.extend(osParams, parameters)
						return callback()

				(callback) ->

					# We need to ensure this directory exists
					mkdirp(path.dirname(options.output), _.unary(callback))

				(callback) ->
					console.info("Destination file: #{options.output}\n")

					bar = new visuals.widgets.Progress('Downloading Device OS')
					spinner = new visuals.widgets.Spinner('Downloading Device OS (size unknown)')

					resin.models.os.download osParams, options.output, (error) ->
						spinner.stop()
						return callback(error)
					, (state) ->
						if state?
							bar.update(state)
						else
							spinner.start()

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

		Examples:

			$ resin os install rpi.iso /dev/disk2
	'''
	options: [ commandOptions.yes ]
	permission: 'user'
	action: (params, options, done) ->

		async.waterfall [

			(callback) ->
				selfupdate.isUpdated(packageJSON, callback)

			(isUpdated, callback) ->
				return callback() if isUpdated

				console.info '''
					Resin CLI is outdated.

					In order to avoid device compatibility issues, this command
					requires that you have the Resin CLI updated.

					Updating now...
				'''

				capitano.run('update', _.unary(callback))

			(callback) ->
				return callback(null, params.device) if params.device?

				# TODO: See if we can reuse the drives action somehow here
				visuals.patterns.selectDrive (error, device) ->
					return callback(error) if error?

					if not device?
						return callback(new Error('No removable devices available'))

					return callback(null, device)

			(device, callback) ->
				params.device = device
				message = "This will completely erase #{params.device}. Are you sure you want to continue?"
				visuals.patterns.confirm(options.yes, message, callback)

			(confirmed, callback) ->
				return done() if not confirmed
				bar = new visuals.widgets.Progress('Writing Device OS')
				params.progress = _.bind(bar.update, bar)
				image.write(params, callback)

		], (error) ->
			return done() if not error?

			if elevate.shouldElevate(error) and not options.fromScript

				# Need to escape every path to avoid errors
				resinWritePath = "\"#{path.join(__dirname, '..', '..', 'bin', 'resin-write')}\""
				elevate.run("\"#{process.argv[0]}\" #{resinWritePath} \"#{params.image}\" \"#{params.device}\"")
			else
				return done(error)
