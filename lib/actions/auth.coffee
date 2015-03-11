_ = require('lodash-contrib')
url = require('url')
async = require('async')
resin = require('resin-sdk')
visuals = require('resin-cli-visuals')

exports.whoami =
	signature: 'whoami'
	description: 'whoami'
	help: '''
		Use this command to get the logged in user name.

		Examples:

			$ resin whoami
	'''
	permission: 'user'
	action: (params, options, done) ->
		resin.auth.whoami (error, username) ->
			return done(error) if error?
			console.log(username)
			return done()

exports.login	=
	signature: 'login [token]'
	description: 'login to resin.io'
	help: '''
		Use this command to login to your resin.io account.

		To login, you need your token, which is accesible from the preferences page:

			https://dashboard.resin.io/preferences?tab=details

		Examples:

			$ resin login
			$ resin login "eyJ0eXAiOiJKV1Qi..."
	'''
	action: (params, options, done) ->
		async.waterfall([

			(callback) ->
				return callback(null, params.token) if params.token?
				visuals.widgets.ask('What\'s your token? (visible in the preferences page)', null, callback)

			(token, callback) ->
				resin.auth.loginWithToken(token, done)

		], done)

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

		Examples:

			$ resin signup
			Email: me@mycompany.com
			Username: johndoe
			Password: ***********

			$ resin signup --email me@mycompany.com --username johndoe --password ***********

			$ resin whoami
			johndoe
	'''
	options: [
		{
			signature: 'email'
			parameter: 'email'
			description: 'user email'
			alias: 'e'
		}
		{
			signature: 'username'
			parameter: 'username'
			description: 'user name'
			alias: 'u'
		}
		{
			signature: 'password'
			parameter: 'user password'
			description: 'user password'
			alias: 'p'
		}
	]
	action: (params, options, done) ->

		hasOptionCredentials = not _.isEmpty(options)

		if hasOptionCredentials

			if not options.email?
				return done(new Error('Missing email'))

			if not options.username?
				return done(new Error('Missing username'))

			if not options.password?
				return done(new Error('Missing password'))

		async.waterfall([

			(callback) ->
				return callback(null, options) if hasOptionCredentials
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
