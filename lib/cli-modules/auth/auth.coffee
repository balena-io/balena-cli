async = require('async')

server = require('../../server/server')
token = require('../../token/token')

exports.authenticate = (credentials, callback) ->
	server.post '/login_', credentials, (error, response) ->
		return callback(error, response?.body)

exports.login = (credentials, callback) ->
	async.waterfall([

		(callback) ->
			exports.authenticate(credentials, callback)

		(authToken, callback) ->
			token.saveToken(authToken, callback)

	], callback)

# Handy aliases
exports.isLoggedIn = token.hasToken
exports.getToken = token.getToken

# TODO: Maybe we should post to /logout or something
# like that to invalidate the token on the server?
exports.logout = token.clearToken
