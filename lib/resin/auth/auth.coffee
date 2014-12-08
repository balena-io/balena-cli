async = require('async')
_ = require('lodash')

token = require('../token/token')
server = require('../server/server')
errors = require('../errors/errors')
settings = require('../settings')

# Authenticate with the server
#
# @private
#
# @param {Object} credentials in the form of username, password
# @option credentials {String} username the username
# @option credentials {String} password user password
# @param {Function} callback callback (error, token)
#
# @note You should use login() when possible, as it takes care of saving the token as well.
#
# @example Authenticate
#		resin.auth.authenticate credentials, (error, token) ->
#			throw error if error?
#			console.log(token)
#
exports.authenticate = (credentials, callback) ->
	server.post settings.get('urls.authenticate'), credentials, (error, response) ->
		savedToken = response?.body
		return callback(error, savedToken)

# Login to Resin.io
#
# Is the login is successful, the token is persisted between sessions.
#
# @param {Object} credentials in the form of username, password
# @option credentials {String} username the username
# @option credentials {String} password user password
# @param {Function} callback callback (error)
#
# @note This function saves the token to the directory configured in dataPrefix
#
# @example Login to Resin.io
#		resin.auth.login credentials, (error) ->
#			throw error if error?
#			console.log('I\'m logged in!')
#
exports.login = (credentials, callback) ->
	async.waterfall([

		(callback) ->
			exports.authenticate(credentials, callback)

		(authToken, callback) ->
			token.saveToken(authToken, callback)

	], callback)

# Check if you're logged in
#
# @param {Function} callback callback (isLoggedIn)
#
# @example Check if logged in
#		resin.auth.isLoggedIn (isLoggedIn) ->
#			if isLoggedIn
#				console.log('I\'m in!')
#			else
#				console.log('Too bad!')
#
exports.isLoggedIn = (callback) ->
	token.hasToken(callback)

# Get current logged in user's token
#
# @param {Function} callback callback (error, isLoggedIn)
#
# @note This function simply delegates to resin.token.getToken() for convenience
#
# @example Get curren token
#		resin.auth.getToken (error, token) ->
#			throw error if error?
#			console.log(token)
#
exports.getToken = (callback) ->
	token.getToken(callback)

# Logout from Resin.io
#
# @param {Function} callback callback (error)
#
# @example Logout from Resin.io
#		resin.auth.logout (error) ->
#			throw error if error?
#			console.log('I\'m out!')
#
# @todo Maybe we should post to /logout or something to invalidate the token on the server?
#
exports.logout = (callback) ->
	token.clearToken(callback)

# Parse colon separated credentials
#
# @private
#
# @param {String} colon separated credentials (username:password)
# @param {Function} callback callback (error, credentials)
#
#	@example Parse credentials
#		resin.auth.parseCredentials 'johndoe:secret', (error, credentials) ->
#			throw error if error?
#			console.log(credentials.username)
#			console.log(credentials.password)
#
exports.parseCredentials = (credentials, callback) ->
	result = credentials.split(':')

	if result.length isnt 2
		error = new errors.InvalidCredentials()
		return callback?(error)

	callback? null,
		username: _.first(result)
		password: _.last(result)
