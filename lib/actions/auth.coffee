Promise = require('bluebird')
_ = require('lodash')
resin = require('resin-sdk')
form = require('resin-cli-form')
visuals = require('resin-cli-visuals')
events = require('resin-cli-events')
validation = require('../utils/validation')

exports.login	=
	signature: 'login'
	description: 'login to resin.io'
	help: '''
		Use this command to login to your resin.io account.

		Examples:

			$ resin login
	'''
	options: [
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
		resin.settings.get('resinUrl')
		.then (resinUrl) ->
			console.log("Logging in to #{resinUrl}")

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
