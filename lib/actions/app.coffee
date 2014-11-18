server = require('../server/server')

exports.list = ->

	# TODO: The details of requesting the API should be handled
	# by the models. Make use of them once they are implemented
	server.get '/ewa/application?$orderby=app_name%20asc&$expand=device', (error, response) ->
		for app in response.body.d
			console.log "#{app.id} - #{app.app_name}"
