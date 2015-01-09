_ = require('lodash')
async = require('async')
path = require('path')
mkdirp = require('mkdirp')
ProgressBar = require('progress')
resin = require('resin-sdk')
log = require('../log/log')
permissions = require('../permissions/permissions')
errors = require('../errors/errors')
cache = require('../cache/cache')

exports.download = (params, options) ->

	# TODO: Evaluate if ConnectionParams is a good name for this object
	# as it includes an application id, which is not connection related
	# Maybe we should move appId outside this class?
	connectionParams = new resin.connection.ConnectionParams
		network: options.network
		wifiSsid: options.ssid
		wifiKey: options.key
		appId: params.id

	# TODO: Change cache.generateCacheName to accept a ConnectionParams instance
	# to avoid the complication of having to omit it from the object and pass
	# as another parameter
	fileName = cache.generateCacheName(params.id, _.omit(connectionParams, 'appId'))

	outputFile = options.output or path.join(resin.settings.get('directories.os'), fileName)

	async.waterfall [

		(callback) ->

			# We need to ensure this directory exists
			mkdirp path.dirname(outputFile), (error) ->
				return callback(error)

		(callback) ->

			bar = null
			received = 0

			resin.models.os.download connectionParams, outputFile, callback, (state) ->

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
