exports.login	=
	signature: 'login'
	description: 'login to resin.io'
	help: '''
		Use this command to login to your resin.io account.

		This command will open your web browser and prompt you to authorize the CLI
		from the dashboard.

		If you don't have access to a web browser (e.g: running in a headless server),
		you can fetch your authentication token from the preferences page and pass
		the token option.

		Alternatively, you can pass the `--credentials` boolean option to perform
		a credential-based authentication, with optional `--email` and `--password`
		options to avoid interactive behaviour (unless you have 2FA enabled).

		Examples:

			$ resin login
			$ resin login --token "..."
			$ resin login --credentials
			$ resin login --credentials --email johndoe@gmail.com --password secret
	'''
	options: [
		{
			signature: 'token'
			description: 'auth token'
			parameter: 'token'
			alias: 't'
		}
		{
			signature: 'credentials'
			description: 'credential-based login'
			boolean: true
			alias: 'c'
		}
		{
 			signature: 'email'
 			parameter: 'email'
 			description: 'email'
 			alias: [ 'e', 'u' ]
 		}
 		{
 			signature: 'password'
 			parameter: 'password'
 			description: 'password'
 			alias: 'p'
 		}
	]
	primary: true
	action: (params, options, done) ->
		Promise = require('bluebird')
		resin = require('resin-sdk')
		events = require('resin-cli-events')
		form = require('resin-cli-form')
		auth = require('resin-cli-auth')
		validation = require('../utils/validation')

		resin.settings.get('resinUrl').then (resinUrl) ->
			console.log("Logging in to #{resinUrl}")

			if options.token?
				return resin.auth.loginWithToken(options.token)
			else if options.credentials
				return form.run [
						message: 'Email:'
						name: 'email'
						type: 'input'
						validate: validation.validateEmail
					,
						message: 'Password:'
						name: 'password'
						type: 'password'
				],
					override: options
				.then(resin.auth.login)
				.then(resin.auth.twoFactor.isPassed)
				.then (isTwoFactorAuthPassed) ->
					return if isTwoFactorAuthPassed
					return form.ask
						message: 'Two factor auth challenge:'
						name: 'code'
						type: 'input'
					.then(resin.auth.twoFactor.challenge)
					.catch ->
						resin.auth.logout().then ->
							throw new Error('Invalid two factor authentication code')

			console.info('Connecting to the web dashboard')
			return auth.login()
		.then(resin.auth.whoami)
		.tap (username) ->
			console.info("Successfully logged in as: #{username}")
			events.send('user.login')
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
		resin = require('resin-sdk')
		events = require('resin-cli-events')

		resin.auth.logout().then ->
			events.send('user.logout')
		.nodeify(done)

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
		resin = require('resin-sdk')
		form = require('resin-cli-form')
		events = require('resin-cli-events')
		validation = require('../utils/validation')

		form.run [
			message: 'Email:'
			name: 'email'
			type: 'input'
			validate: validation.validateEmail
		,
			message: 'Username:'
			name: 'username'
			type: 'input'
		,
			message: 'Password:'
			name: 'password'
			type: 'password',
			validate: validation.validatePassword
		]

		.then(resin.auth.register)
		.then(resin.auth.loginWithToken)
		.tap ->
			events.send('user.signup')
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
		Promise = require('bluebird')
		resin = require('resin-sdk')
		visuals = require('resin-cli-visuals')

		Promise.props
			username: resin.auth.whoami()
			email: resin.auth.getEmail()
			url: resin.settings.get('resinUrl')
		.then (results) ->
			console.log visuals.table.vertical results, [
				'$account information$'
				'username'
				'email'
				'url'
			]
		.nodeify(done)
