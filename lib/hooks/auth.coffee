_ = require('lodash')
resin = require('../resin')

exports.failIfNotLoggedIn = (fn, onError) ->
	return ->
		args = arguments
		resin.auth.isLoggedIn (isLoggedIn) ->

			if not isLoggedIn
				error = new Error('You have to log in')
				if onError?
					return onError(error)
				else
					throw error

			fn.apply(null, args)
