open = require('open')
url = require('url')
resin = require('../resin')

exports.preferences = ->
	preferencesUrl = resin.settings.get('urls.preferences')
	absUrl = url.resolve(resin.settings.get('remoteUrl'), preferencesUrl)
	open(absUrl)
