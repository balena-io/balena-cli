_ = require('lodash')
request = require('request')
urlResolve = require('url').resolve
async = require('async')
connection = require('../connection/connection')
config = require('../config')
token = require('../token/token')

exports.request = (options = {}, callback) ->

	if not options.url?
		throw new Error('Missing URL')

	async.waterfall [

		(callback) ->
			connection.isOnline(callback)

		(isOnline, callback) ->
			if not isOnline
				return callback(new Error('You need internet connection to perform this task'))

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

createFacadeFunction = (method) ->
	lowerCaseMethod = method.toLowerCase()
	exports[lowerCaseMethod] = (url, body, callback) ->
		options = {
			method
			url
		}

		if _.isFunction(body)
			callback = body
		else
			options.json = body

		return exports.request(options, callback)

for method in [
	'GET'
	'HEAD'
	'POST'
	'PATCH'
	'PUT'
	'DELETE'
]
	createFacadeFunction(method)
