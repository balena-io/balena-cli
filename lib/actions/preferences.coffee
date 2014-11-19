open = require('open')
config = require('../config')
authHooks = require('../hooks/auth')

exports.preferences = authHooks.failIfNotLoggedIn ->
	open(config.urls.preferences)
