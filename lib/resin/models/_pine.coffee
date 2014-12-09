_ = require('lodash')
Promise = require('bluebird')
PinejsClientCore = require('pinejs-client-js')(_, Promise)
settings = require('../settings')
server = require('../server/server')
promisifiedServerRequest = Promise.promisify(server.request, server)

class PinejsClientRequest extends PinejsClientCore

	# Trigger a request to the resin.io API
	#
	# Makes use of [pinejs-client-js](https://bitbucket.org/rulemotion/pinejs-client-js)
	#
	# @private
	#
	# @param {Object} params request params (same as node-request params)
	#
	# @note You shouldn't make use of this method directly, but through models
	#
	_request: (params) ->
		params.json = params.data
		params.gzip ?= true
		promisifiedServerRequest(params).spread (response, body) ->
			if 200 <= response.statusCode < 300
				return body
			throw new Error(body)

module.exports = new PinejsClientRequest
	apiPrefix: settings.get('apiPrefix')
