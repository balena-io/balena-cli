server = require('../server/server')
applicationModel = require('../models/application')
authHooks = require('../hooks/auth')

exports.list = authHooks.failIfNotLoggedIn ->

	applicationModel.getAll().then (applications) ->
		for app in applications
			console.log "#{app.id} - #{app.app_name}"
