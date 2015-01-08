_ = require('lodash')
async = require('async')
path = require('path')
mkdirp = require('mkdirp')
ProgressBar = require('progress')
resin = require('resin-sdk')
connection = require('../connection/connection')
log = require('../log/log')
permissions = require('../permissions/permissions')
errors = require('../errors/errors')
cache = require('../cache/cache')
resin = require('../resin')

exports.download = (params, options) ->
	networkParams =
		network: options.network
		wifiSsid: options.ssid
		wifiKey: options.key

	fileName = cache.generateCacheName(params.id, networkParams)
	outputFile = options.output or path.join(resin.settings.get('directories.os'), fileName)

	async.waterfall [

		(callback) ->

			# We need to ensure this directory exists
			mkdirp path.dirname(outputFile), (error) ->
				return callback(error)

		(callback) ->
			connection.parseConnectionParameters(networkParams, callback)

		(parameters, callback) ->
			parameters.appId = params.id

			bar = null
			received = 0

			resin.models.os.download parameters, outputFile, callback, (state) ->

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
		errors.handle(error) if error?
		log.info("\nFinished downloading #{outputFile}")
