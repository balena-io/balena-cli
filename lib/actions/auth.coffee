Promise = require('bluebird')
open = Promise.promisify(require('open'))
_ = require('lodash')
url = require('url')
resin = require('resin-sdk')
settings = require('resin-settings-client')
form = require('resin-cli-form')
visuals = require('resin-cli-visuals')
validEmail = require('valid-email')

TOKEN_URL = url.resolve(settings.get('dashboardUrl'), '/preferences')

exports.login	=
	signature: 'login [token]'
	description: 'login to resin.io'
	help: """
		Use this command to login to your resin.io account.

		To login, you need your token, which is accesible from the preferences page:

			#{TOKEN_URL}

		Examples:

			$ resin login
			$ resin login "eyJ0eXAiOiJKV1Qi..."
	"""
	action: (params, options, done) ->
		Promise.try ->
			return params.token if params.token?

			console.info """
				To login to the Resin CLI, you need your unique token, which is accesible from
				the preferences page at #{TOKEN_URL}

				Attempting to open a browser at that location...
			"""

			open(TOKEN_URL).catch ->
				console.error """
					Unable to open a web browser in the current environment.
					Please visit #{TOKEN_URL} manually.
				"""
			.then ->
				form.ask
					message: 'What\'s your token? (visible in the preferences page)'
					type: 'input'

		.then(resin.auth.loginWithToken)
		.then(resin.auth.whoami)
		.tap (username) ->
			console.info("Successfully logged in as: #{username}")
		.nodeify(done)

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
		resin.auth.logout().nodeify(done)

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

			$ resin whoami
			johndoe
	'''
	action: (params, options, done) ->
		form.run [
			message: 'Email:'
			name: 'email'
			type: 'input'
			validate: (input) ->
				if not validEmail(input)
					return 'Email is not valid'

				return true
		,
			message: 'Username:'
			name: 'username'
			type: 'input'
		,
			message: 'Password:'
			name: 'password'
			type: 'password',
			validate: (input) ->
				if input.length < 8
					return 'Password should be 8 characters long'

				return true
		]

		.then(resin.auth.register)
		.then(resin.auth.loginWithToken)
		.nodeify(done)

exports.whoami =
	signature: 'whoami'
	description: 'get current username and email address'
	help: '''
		Use this command to find out the current logged in username and email address.

		Examples:

			$ resin whoami
	'''
	permission: 'user'
	action: (params, options, done) ->
		Promise.props
			username: resin.auth.whoami()
			email: resin.auth.getEmail()
		.then (results) ->
			console.log visuals.table.vertical results, [
				'$account information$'
				'username'
				'email'
			]
		.nodeify(done)
