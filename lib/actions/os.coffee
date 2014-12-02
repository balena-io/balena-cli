_ = require('lodash')
async = require('async')
path = require('path')
mkdirp = require('mkdirp')
url = require('url')
resin = require('../resin')
connection = require('../connection/connection')

exports.download = (id) ->
	params =
		network: resin.cli.getArgument('network')
		wifiSsid: resin.cli.getArgument('wifiSsid')
		wifiKey: resin.cli.getArgument('wifiKey')

	fileName = resin.os.generateCacheName(id, params)
	outputFile = path.join(resin.config.osDirectory, fileName)

	async.waterfall [

		(callback) ->

			# We need to ensure this directory exists
			mkdirp resin.config.osDirectory, (error) ->
				return callback(error)

		(callback) ->
			connection.parseConnectionParameters(params, callback)

		(parameters, callback) ->
			parameters.appId = id

			query = url.format(query: parameters)
			downloadUrl = url.resolve(resin.config.urls.download, query)

			return callback(null, downloadUrl)

		(downloadUrl, callback) ->
			resin.ui.patterns.downloadFile(downloadUrl, outputFile, callback)

	], (error) ->
		resin.errors.handle(error) if error?
		console.log "\n\nFinished downloading #{outputFile}"
