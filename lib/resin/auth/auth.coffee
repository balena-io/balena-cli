async = require('async')
_ = require('lodash-contrib')

token = require('./token/token')
server = require('../server/server')
data = require('../data/data')
errors = require('../_errors/errors')
settings = require('../settings')

# Return current logged in username
#
# @param {Function} callback callback (error, username)
#
# @note This will only work if you used login() to log in.
#
# @example Who am I?
#		resin.auth.whoami (error, username) ->
#			throw error if error?
#
#			if not username?
#				console.log('I\'m not logged in!')
#			else
#				console.log("My username is: #{username}")
#
exports.whoami = (callback) ->
	usernameKey = settings.get('keys.username')
	data.getText(usernameKey, callback)

# Authenticate with the server
#
# @private
#
# @param {Object} credentials in the form of username, password
# @option credentials {String} username the username
# @option credentials {String} password user password
# @param {Function} callback callback (error, token, username)
#
# @note You should use login() when possible, as it takes care of saving the token and username as well.
#
# @example Authenticate
#		resin.auth.authenticate credentials, (error, token, username) ->
#			throw error if error?
#			console.log("My username is: #{username}")
#			console.log("My token is: #{token}")
#
exports.authenticate = (credentials, callback) ->
	server.post settings.get('urls.authenticate'), credentials, (error, response) ->
		return callback(error) if error?
		savedToken = response?.body
		return callback(null, savedToken, credentials.username)

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

		(authToken, username, callback) ->
			token.saveToken(authToken, callback)

		(callback) ->
			usernameKey = settings.get('keys.username')
			data.setText(usernameKey, credentials.username, callback)

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
# @note This function simply delegates to resin.token.getToken() for convenience.
# @note This will only work if you used login() to log in.
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
exports.logout = (callback = _.noop) ->
	async.parallel([

		(callback) ->
			token.clearToken(callback)

		(callback) ->
			usernameKey = settings.get('keys.username')
			data.remove(usernameKey, callback)

	], _.unary(callback))

# Parse colon separated credentials
#
# @private
#
# @param {String} colon separated credentials (username:password)
# @param {Function} callback callback (error, credentials)
#
# @todo This should be moved somewhere else, as it only used by the auth actions
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
