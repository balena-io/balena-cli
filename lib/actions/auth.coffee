open = require('open')
auth = require('../auth/auth')
config = require('../config')

exports.login	= (credentials) ->
	parsedCredentials = auth.parseCredentials(credentials)
	auth.login parsedCredentials, (error) ->
		throw error if error?

exports.logout = ->
	auth.logout()

exports.signup = ->
	open(config.urls.signup)
