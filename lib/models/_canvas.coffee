_ = require('lodash')
Canvas = require('resin-platform-api')
Promise = require('bluebird')
config = require('../config')
resin = require('../resin')
promisifiedServerRequest = Promise.promisify(resin.server.request)

class CanvasRequestService extends Canvas(_, Promise)
	_request: (params) ->
		params.json = params.data
		params.gzip ?= true
		promisifiedServerRequest(params).spread (response, body) ->
			if 200 <= response.statusCode < 300
				return body
			throw new Error(body)

module.exports = new CanvasRequestService
	url: config.remoteUrl
	apiPrefix: config.apiPrefix
	withCredentials: true
