_ = require('lodash')
async = require('async')
path = require('path')
mkdirp = require('mkdirp')
ProgressBar = require('progress')
resin = require('resin-sdk')
permissions = require('../permissions/permissions')

exports.download = (params, options, done) ->

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

				# TODO: Allow quieting this progress bar
				bar ?= new ProgressBar 'Downloading device OS [:bar] :percent :etas',
					complete: '='
					incomplete: ' '
					width: 40
					total: state.total

				return if bar.complete or not state?

				bar.tick(state.received - received)
				received = state.received

	], (error) ->
		return done(error) if error?
		console.info("\nFinished downloading #{outputFile}")
		return done()
