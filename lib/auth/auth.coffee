async = require('async')
_ = require('lodash')

resin = require('../resin')

exports.authenticate = (credentials, callback) ->
	resin.server.post '/login_', credentials, (error, response) ->
		return callback(error, response?.body)

exports.login = (credentials, callback) ->
	async.waterfall([

		(callback) ->
			exports.authenticate(credentials, callback)

		(authToken, callback) ->
			resin.token.saveToken(authToken, callback)

	], callback)

# Handy aliases
exports.isLoggedIn = resin.token.hasToken
exports.getToken = resin.token.getToken

# TODO: Maybe we should post to /logout or something
# like that to invalidate the token on the server?
exports.logout = resin.token.clearToken

exports.parseCredentials = (credentials, callback) ->
	result = credentials.split(':')

	if result.length isnt 2
		error = new Error('Invalid credentials. The expected input is username:password.')
		return callback?(error)

	callback? null,
		username: _.first(result)
		password: _.last(result)
