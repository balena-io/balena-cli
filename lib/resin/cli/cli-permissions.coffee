auth = require('../auth/auth')

exports.user = (fn, onError) ->
	return ->
		args = arguments
		auth.isLoggedIn (isLoggedIn) ->

			if not isLoggedIn
				error = new Error('You have to log in')
				if onError?
					return onError(error)
				else
					throw error

			fn.apply(null, args)
