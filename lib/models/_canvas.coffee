_ = require('lodash')
Canvas = require('resin-platform-api')
Promise = require('bluebird')
config = require('../config')
server = require('../server/server')
promisifiedServerRequest = Promise.promisify(server.request, server)

# TODO: I've copy and pasted request.coffee that comes with
# resin-platform-api. In package.json, the main is set as
# simply canvas.js, so I have no way of access this file.
class CanvasRequestService extends Canvas(_, Promise)
	_request: (params) ->
		params.json = true
		params.gzip ?= true
		promisifiedServerRequest(params).spread (response, body) ->
			if 200 <= response.statusCode < 300
				return body
			throw new Error(body)

module.exports = new CanvasRequestService
	url: config.remoteUrl
	apiPrefix: config.apiPrefix
	withCredentials: true
