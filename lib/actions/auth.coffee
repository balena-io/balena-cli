auth = require('../auth/auth')

exports.login	= (credentials) ->
	parsedCredentials = auth.parseCredentials(credentials)
	auth.login parsedCredentials, (error) ->
		throw error if error?
