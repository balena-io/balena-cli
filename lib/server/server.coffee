_ = require('lodash')
request = require('request')
urlResolve = require('url').resolve
async = require('async')
config = require('../config')
token = require('../token/token')

exports.request = (options = {}, callback) ->

	if not options.url?
		throw new Error('Missing URL')

	async.waterfall [

		(callback) ->
			token.getToken(callback)

		(savedToken, callback) ->
			options.url = urlResolve(config.remoteUrl, options.url)

			if options.method?
				options.method = options.method.toUpperCase()

			_.defaults options,
				method: 'GET'
				gzip: true

			if savedToken?
				options.headers ?= {}
				_.extend options.headers,
					'Authorization': "Bearer #{savedToken}"

			request(options, callback)

		(response, body, callback) ->
			try
				response.body = JSON.parse(response.body)

			if response?.statusCode >= 400
				error = new Error(response.body)

			return callback(error, response, response.body)

	], callback

exports.get = (url, callback) ->
	return exports.request {
		method: 'GET'
		url: url
	}, callback

exports.head = (url, callback) ->
	return exports.request {
		method: 'HEAD'
		url: url
	}, callback

exports.delete = (url, callback) ->
	return exports.request {
		method: 'DELETE'
		url: url
	}, callback

exports.post = (url, json, callback) ->
	return exports.request {
		method: 'POST'
		url: url
		json: json
	}, callback

exports.put = (url, json, callback) ->
	return exports.request {
		method: 'PUT'
		url: url
		json: json
	}, callback

exports.patch = (url, json, callback) ->
	return exports.request {
		method: 'PATCH'
		url: url
		json: json
	}, callback
