request = require('request')
urljoin = require('url-join')
config = require('../config')

exports.request = (method = 'GET', uri, json, callback) ->
	method = method.toUpperCase()
	uri = urljoin(config.baseUrl, uri)

	request {
		uri
		method
		json
	}, (error, response, body) ->
		try
			response.body = JSON.parse(response.body)

		if response?.statusCode >= 400
			error = new Error(response.body)

		return callback?.call(null, error, response, body)

exports.get = (uri, callback) ->
	return exports.request('GET', uri, null, callback)

exports.head = (uri, callback) ->
	return exports.request('HEAD', uri, null, callback)

exports.delete = (uri, callback) ->
	return exports.request('DELETE', uri, null, callback)

exports.post = (uri, json, callback) ->
	return exports.request('POST', uri, json, callback)

exports.put = (uri, json, callback) ->
	return exports.request('PUT', uri, json, callback)

exports.patch = (uri, json, callback) ->
	return exports.request('PATCH', uri, json, callback)
