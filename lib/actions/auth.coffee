_ = require('lodash-contrib')
url = require('url')
async = require('async')
resin = require('resin-sdk')
ui = require('../ui')
permissions = require('../permissions/permissions')
helpers = require('../helpers/helpers')

exports.login	= (params, options, done) ->
	async.waterfall [

		(callback) ->
			if params.credentials?
				return helpers.parseCredentials(params.credentials, callback)
			else
				return ui.widgets.login(callback)

		(credentials, callback) ->
			resin.auth.login(credentials, callback)

	], done

exports.logout = permissions.user (params, options, done) ->
	resin.auth.logout(done)

exports.signup = (params, options, done) ->
	async.waterfall([

		(callback) ->
			ui.widgets.register(callback)

		(credentials, callback) ->
			resin.auth.register credentials, (error, token) ->
				return callback(error, credentials)

		(credentials, callback) ->
			resin.auth.login(credentials, callback)

	], done)

exports.whoami = permissions.user (params, options, done) ->
	resin.auth.whoami (error, username) ->

		if not username?
			return done(new Error('Username not found'))

		console.log(username)
