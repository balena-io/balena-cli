server = require('../server/server')
applicationModel = require('../models/application')

exports.list = ->

	applicationModel.getAll().then (applications) ->
		for app in applications
			console.log "#{app.id} - #{app.app_name}"
