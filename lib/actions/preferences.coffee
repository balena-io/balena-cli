open = require('open')
url = require('url')
resin = require('../resin')

exports.preferences = ->
	preferencesUrl = resin.settings.urls.preferences
	absUrl = url.resolve(resin.settings.remoteUrl, preferencesUrl)
	open(absUrl)
