open = require('open')
url = require('url')
resin = require('../resin')
permissions = require('../permissions/permissions')

exports.preferences = permissions.user ->
	preferencesUrl = resin.settings.get('urls.preferences')
	absUrl = url.resolve(resin.settings.get('remoteUrl'), preferencesUrl)
	open(absUrl)
