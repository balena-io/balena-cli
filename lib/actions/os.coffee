_ = require('lodash')
async = require('async')
path = require('path')
mkdirp = require('mkdirp')
url = require('url')
resin = require('../resin')
connection = require('../connection/connection')
ui = require('../ui')
permissions = require('../permissions/permissions')

exports.download = (params, options) ->
	networkParams =
		network: options.network
		wifiSsid: options.ssid
		wifiKey: options.key

	fileName = resin.os.generateCacheName(params.id, networkParams)
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

			query = url.format(query: parameters)
			downloadUrl = url.resolve(resin.settings.get('urls.download'), query)

			return callback(null, downloadUrl)

		(downloadUrl, callback) ->
			ui.patterns.downloadFile(downloadUrl, outputFile, callback)

	], (error) ->
		resin.errors.handle(error) if error?
		resin.log.info("\nFinished downloading #{outputFile}")
