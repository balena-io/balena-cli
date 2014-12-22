url = require('url')
fs = require('fs')
server = require('../server/server')
settings = require('../settings')

exports.download = (parameters, destination, callback, onProgress) ->
	query = url.format(query: parameters)
	downloadUrl = url.resolve(settings.get('urls.download'), query)

	server.request
		method: 'GET'
		url: downloadUrl
		pipe: fs.createWriteStream(destination)
	, callback
	, onProgress
