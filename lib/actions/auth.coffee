url = require('url')
open = require('open')
async = require('async')
resin = require('../resin')
ui = require('../ui')
permissions = require('../permissions/permissions')

exports.login	= (params) ->
	async.waterfall [

		(callback) ->
			if params.credentials?
				return resin.auth.parseCredentials(params.credentials, callback)
			else
				return ui.widgets.login(callback)

		(credentials, callback) ->
			resin.auth.login(credentials, callback)

	], resin.errors.handle

exports.logout = permissions.user ->
	resin.auth.logout()

exports.signup = ->
	signupUrl = resin.settings.get('urls.signup')
	absUrl = url.resolve(resin.settings.get('remoteUrl'), signupUrl)
	open(absUrl)

exports.whoami = permissions.user ->
	resin.auth.whoami (error, username) ->
		resin.errors.handle(error) if error?

		if not username?
			error = new Error('Username not found')
			resin.errors.handle(error)

		resin.log.out(username)
