_ = require('lodash')
request = require('request')
progress = require('request-progress')
async = require('async')
connection = require('../../connection/connection')
settings = require('../settings')
auth = require('../auth/auth')

# @nodoc
urlResolve = require('url').resolve

# Send an HTTP request to resin.io
#
# @param {Object} options request options
# @option options {String} url relative url
# @option options {String} json request body
# @option options {String} method HTTP method
# @option options {Object} headers custom HTTP headers
# @option options {Function} pipe define this function if you want to stream the response
#
# @param {Function} callback callback(error, response, body)
# @param {Function} onProgress on progress callback(state) (optional)
#
# @note If the user is logged in, the token gets automatically added to Authorization header
# @note If the response is JSON, it will attempt to parse it
#
# @throw {Error} Will throw if you don't have internet connection
#
# @example GET request
#		resin.server.request {
#			method: 'GET'
#			url: '/foobar'
#		}, (error, response, body) ->
#			throw error if error?
#			console.log(body)
#
#	@example POST request with body
#		resin.server.request {
#			method: 'POST'
#			url: '/foobar'
#			json:
#				name: 'My FooBar'
#		}, (error, response, body) ->
#			throw error if error?
#			assert(response.statusCode is 201)
#
#	@example Stream download
#		resin.server.request {
#			method: 'GET'
#			url: '/download'
#			pipe: fs.createWriteStream('/tmp/download')
#		}, (error) ->
#			throw error if error?
#		, (state) ->
#			console.log("Received: #{state.received}")
#			console.log("Total: #{state.total}")
#			console.log("Is Complete? #{state.complete}")
#
exports.request = (options = {}, outerCallback, onProgress) ->

	onProgress ?= _.noop

	if not options.url?
		throw new Error('Missing URL')

	async.waterfall [

		(callback) ->
			connection.isOnline(callback)

		(isOnline, callback) ->
			if not isOnline
				return callback(new Error('You need internet connection to perform this task'))

			auth.getToken(callback)

		(savedToken, callback) ->
			options.url = urlResolve(settings.get('remoteUrl'), options.url)

			if options.method?
				options.method = options.method.toUpperCase()

			_.defaults options,
				method: 'GET'
				gzip: true

			if savedToken?
				options.headers ?= {}
				_.extend options.headers,
					'Authorization': "Bearer #{savedToken}"

			if options.pipe?
				progress(request(options))
					.on('progress', onProgress)
					.on('error', outerCallback)
					.on('end', onProgress)
					.pipe(options.pipe)
					.on('error', outerCallback)
					.on('close', outerCallback)
			else
				return request(options, callback)

		(response, body, callback) ->
			try
				response.body = JSON.parse(response.body)

			if response?.statusCode >= 400
				error = new Error(response.body)

			return callback(error, response, response.body)

	], outerCallback

# Generate shorthand functions for every method
#
# @private
#
# @todo Find a way to document all of the methods directly
#
createFacadeFunction = (method) ->
	lowerCaseMethod = method.toLowerCase()
	exports[lowerCaseMethod] = (url, body, callback, onProgress) ->
		options = {
			method
			url
		}

		if _.isFunction(body)
			onProgress = callback
			callback = body
		else
			options.json = body

		return exports.request(options, callback, onProgress)

for method in [
	'GET'
	'HEAD'
	'POST'
	'PATCH'
	'PUT'
	'DELETE'
]
	createFacadeFunction(method)
