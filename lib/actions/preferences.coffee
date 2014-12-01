open = require('open')
url = require('url')
resin = require('../resin')

exports.preferences = ->
	preferencesUrl = resin.config.urls.preferences
	absUrl = url.resolve(resin.config.remoteUrl, preferencesUrl)
	open(absUrl)
