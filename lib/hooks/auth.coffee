_ = require('lodash')
resin = require('../resin')
messages = require('../messages/messages')

exports.failIfNotLoggedIn = (fn, onError) ->
	return ->
		args = arguments
		resin.auth.isLoggedIn (isLoggedIn) ->

			if not isLoggedIn
				error = new Error(messages.errors.loginRequired)
				if onError?
					return onError(error)
				else
					throw error

			fn.apply(null, args)
