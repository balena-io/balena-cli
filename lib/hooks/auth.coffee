auth = require('../auth/auth')
messages = require('../messages/messages')

exports.failIfNotLoggedIn = (fn) ->
	return ->
		auth.isLoggedIn (isLoggedIn) ->
			if not isLoggedIn
				throw new Error(messages.errors.loginRequired)

			fn.apply(null, arguments)
