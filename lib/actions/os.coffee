_ = require('lodash')
async = require('async')
path = require('path')
mkdirp = require('mkdirp')
url = require('url')
resin = require('../resin')
connection = require('../connection/connection')
cli = require('../cli/cli')

exports.download = (id) ->
	params =
		network: cli.getArgument('network')
		wifiSsid: cli.getArgument('wifiSsid')
		wifiKey: cli.getArgument('wifiKey')

	fileName = resin.os.generateCacheName(id, params)
	outputFile = cli.getArgument('output') or path.join(resin.settings.get('directories.os'), fileName)

	async.waterfall [

		(callback) ->

			# We need to ensure this directory exists
			mkdirp path.dirname(outputFile), (error) ->
				return callback(error)

		(callback) ->
			connection.parseConnectionParameters(params, callback)

		(parameters, callback) ->
			parameters.appId = id

			query = url.format(query: parameters)
			downloadUrl = url.resolve(resin.settings.get('urls.download'), query)

			return callback(null, downloadUrl)

		(downloadUrl, callback) ->
			resin.ui.patterns.downloadFile(downloadUrl, outputFile, callback)

	], (error) ->
		resin.errors.handle(error) if error?
		resin.log.info("\nFinished downloading #{outputFile}")
