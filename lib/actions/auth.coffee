_ = require('lodash-contrib')
url = require('url')
async = require('async')
resin = require('resin-sdk')
visuals = require('resin-cli-visuals')
helpers = require('../helpers/helpers')

exports.login	=
	signature: 'login [credentials]'
	description: 'login to resin.io'
	help: '''
		Use this command to login to your resin.io account.
		You need to login before you can use most of the commands this tool provides.

		You can pass your credentials as a colon separated string, or you can omit the
		credentials, in which case the tool will present you with an interactive login form.

		Examples:
			$ resin login username:password
			$ resin login
	'''
	action: (params, options, done) ->
		async.waterfall [

			(callback) ->
				if params.credentials?
					return helpers.parseCredentials(params.credentials, callback)
				else
					return visuals.widgets.login(callback)

			(credentials, callback) ->
				resin.auth.login(credentials, callback)

		], done

exports.logout =
	signature: 'logout'
	description: 'logout from resin.io'
	help: '''
		Use this command to logout from your resin.io account.o

		Examples:
			$ resin logout
	'''
	permission: 'user'
	action: (params, options, done) ->
		resin.auth.logout(done)

exports.signup =
	signature: 'signup'
	description: 'signup to resin.io'
	help: '''
		Use this command to signup for a resin.io account.

		If signup is successful, you'll be logged in to your new user automatically.

		TODO: We need to provide a non interactive way to use this command,
		however it's not clear to me how to do it easily for now.

		Examples:
			$ resin signup
			Email: me@mycompany.com
			Username: johndoe
			Password: ***********

			$ resin whoami
			johndoe
	'''
	action: (params, options, done) ->
		async.waterfall([

			(callback) ->
				visuals.widgets.register(callback)

			(credentials, callback) ->
				resin.auth.register credentials, (error, token) ->
					return callback(error, credentials)

			(credentials, callback) ->
				resin.auth.login(credentials, callback)

		], done)

exports.whoami =
	signature: 'whoami'
	description: 'get current username'
	help: '''
		Use this command to find out the current logged in username.

		Examples:
			$ resin whoami
	'''
	permission: 'user'
	action: (params, options, done) ->
		resin.auth.whoami (error, username) ->

			if not username?
				return done(new Error('Username not found'))

			console.log(username)
