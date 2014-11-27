open = require('open')
async = require('async')
resin = require('../resin')

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

exports.logout = ->
	resin.auth.logout()

exports.signup = ->
	open(resin.config.urls.signup)
