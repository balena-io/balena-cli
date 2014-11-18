open = require('open')
async = require('async')
auth = require('../auth/auth')
authHooks = require('../hooks/auth')
widgets = require('../widgets/widgets')
config = require('../config')

exports.login	= (credentials) ->
	async.waterfall [

		(callback) ->
			if credentials?
				return auth.parseCredentials(credentials, callback)
			else
				return widgets.login(callback)

		(credentials, callback) ->
			auth.login(credentials, callback)

	], (error) ->
		throw error if error?

exports.logout = authHooks.failIfNotLoggedIn ->
	auth.logout()

exports.signup = ->
	open(config.urls.signup)
