open = require('open')

module.exports = (resin) ->

	resin.cli.addCommand
		command: 'preferences'
		description: 'open preferences form'
		permission: 'user'
		action: ->
			open(resin.config.urls.preferences)
