open = require('open')
url = require('url')
resin = require('resin-sdk')

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
		preferencesUrl = resin.settings.get('urls.preferences')
		absUrl = url.resolve(resin.settings.get('remoteUrl'), preferencesUrl)
		open(absUrl)
