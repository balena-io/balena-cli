request = require('request')
urljoin = require('url-join')
async = require('async')
config = require('../config')
token = require('../token/token')

exports.request = (method = 'GET', url, json, callback) ->
	method = method.toUpperCase()
	url = urljoin(config.baseUrl, url)

	async.waterfall [

		(callback) ->
			token.getToken(callback)

		(savedToken, callback) ->
			requestOptions = {
				url
				method
				json
			}

			if savedToken?
				requestOptions.headers =
					'Authorization': "Bearer #{savedToken}"

			request(requestOptions, callback)

		(response, body, callback) ->
			try
				response.body = JSON.parse(response.body)

			if response?.statusCode >= 400
				error = new Error(response.body)

			return callback(error, response, body)

	], callback

exports.get = (url, callback) ->
	return exports.request('GET', url, null, callback)

exports.head = (url, callback) ->
	return exports.request('HEAD', url, null, callback)

exports.delete = (url, callback) ->
	return exports.request('DELETE', url, null, callback)

exports.post = (url, json, callback) ->
	return exports.request('POST', url, json, callback)

exports.put = (url, json, callback) ->
	return exports.request('PUT', url, json, callback)

exports.patch = (url, json, callback) ->
	return exports.request('PATCH', url, json, callback)
