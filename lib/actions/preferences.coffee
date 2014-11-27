open = require('open')
resin = require('../resin')

exports.preferences = ->
	open(resin.config.urls.preferences)
