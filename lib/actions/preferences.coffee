open = require('open')
authHooks = require('../hooks/auth')

exports.preferences = authHooks.failIfNotLoggedIn ->
	open(resin.config.urls.preferences)
