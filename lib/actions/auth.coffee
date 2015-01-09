_ = require('lodash-contrib')
url = require('url')
async = require('async')
resin = require('resin-sdk')
ui = require('../ui')
log = require('../log/log')
errors = require('../errors/errors')
permissions = require('../permissions/permissions')
helpers = require('../helpers/helpers')

exports.login	= (params) ->
	async.waterfall [

		(callback) ->
			if params.credentials?
				return helpers.parseCredentials(params.credentials, callback)
			else
				return ui.widgets.login(callback)

		(credentials, callback) ->
			resin.auth.login(credentials, callback)

	], errors.handle

exports.logout = permissions.user ->
	resin.auth.logout(_.unary(errors.handle))

exports.signup = ->
	async.waterfall([

		(callback) ->
			ui.widgets.register(callback)

		(credentials, callback) ->
			resin.auth.register credentials, (error, token) ->
				return callback(error, credentials)

		(credentials, callback) ->
			resin.auth.login(credentials, callback)

	], errors.handle)

exports.whoami = permissions.user ->
	resin.auth.whoami errors.handleCallback (username) ->

		if not username?
			error = new Error('Username not found')
			errors.handle(error)

		log.out(username)
