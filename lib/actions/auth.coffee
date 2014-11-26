open = require('open')
async = require('async')
resin = require('../resin')
authHooks = require('../hooks/auth')

exports.login	= (credentials) ->
	async.waterfall [

		(callback) ->
			if credentials?
				return resin.auth.parseCredentials(credentials, callback)
			else
				return resin.ui.widgets.login(callback)

		(credentials, callback) ->
			resin.auth.login(credentials, callback)

	], resin.errors.handle

exports.logout = authHooks.failIfNotLoggedIn ->
	resin.auth.logout()

exports.signup = ->
	open(resin.config.urls.signup)
