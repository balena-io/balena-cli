server = require('../../server/server')

exports.getToken = (credentials, callback) ->
	server.post '/login_', credentials, (error, response) ->
		return callback(error, response?.body)

exports.login = (credentials, callback) ->
	exports.getToken(credentials, callback)
