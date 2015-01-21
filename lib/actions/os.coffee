_ = require('lodash')
async = require('async')
path = require('path')
mkdirp = require('mkdirp')
resin = require('resin-sdk')
visuals = require('resin-cli-visuals')

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
		{
			signature: 'network'
			parameter: 'network'
			description: 'network type'
			alias: 'n'
		}
		{
			signature: 'ssid'
			parameter: 'ssid'
			description: 'wifi ssid, if network is wifi'
			alias: 's'
		}
		{
			signature: 'key'
			parameter: 'key'
			description: 'wifi key, if network is wifi'
			alias: 'k'
		}
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

		outputFile = options.output or path.join(resin.settings.get('directories.os'), fileName)

		async.waterfall [

			(callback) ->

				# We need to ensure this directory exists
				mkdirp path.dirname(outputFile), (error) ->
					return callback(error)

			(callback) ->
				console.info("Destination file: #{outputFile}")

				bar = null
				received = 0

				resin.models.os.download osParams, outputFile, callback, (state) ->
					return if options.quiet

					bar ?= new visuals.widgets.Progress('Downloading device OS', state.total)

					return if bar.complete or not state?

					bar.tick(state.received - received)
					received = state.received

		], (error) ->
			return done(error) if error?
			console.info("\nFinished downloading #{outputFile}")
			return done()
