resin = require('resin-sdk')

exports.user = (fn, onError) ->
	return ->
		args = arguments
		resin.auth.isLoggedIn (isLoggedIn) ->

			if not isLoggedIn
				error = new Error('You have to log in')
				if onError?
					return onError(error)
				else
					console.error(error.message)
					process.exit(1)

			fn.apply(null, args)
