open = require('open')
config = require('../config')

exports.preferences = ->
	open(config.urls.preferences)
