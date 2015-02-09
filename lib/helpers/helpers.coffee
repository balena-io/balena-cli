_ = require('lodash')
getStdin = require('get-stdin')

exports.readStdin = (callback) ->
	getStdin (result) ->
		return callback(null, result)

exports.parseCredentials = (credentials, callback) ->
	result = credentials.split(':')

	if result.length isnt 2
		error = new Error('Invalid credentials')
		return callback?(error)

	callback? null,
		username: _.first(result)
		password: _.last(result)
