open = require('open')
url = require('url')
settings = require('resin-settings-client')

exports.preferences =
	signature: 'preferences'
	description: 'open preferences form'
	help: '''
		Use this command to open the preferences form.

		In the future, we will allow changing all preferences directly from the terminal.
		For now, we open your default web browser and point it to the web based preferences form.

		Examples:

			$ resin preferences
	'''
	permission: 'user'
	action: ->
		absUrl = url.resolve(settings.get('remoteUrl'), '/preferences')
		open(absUrl)
