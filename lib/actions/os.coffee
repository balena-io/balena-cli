_ = require('lodash')
async = require('async')
path = require('path')
mkdirp = require('mkdirp')
ProgressBar = require('progress')
resin = require('resin-sdk')
log = require('../log/log')
permissions = require('../permissions/permissions')
errors = require('../errors/errors')

exports.download = (params, options) ->

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
			log.info("Destination file: #{outputFile}")

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

	], errors.handleCallback ->
		log.info("\nFinished downloading #{outputFile}")
