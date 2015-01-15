packageJSON = require('../../package.json')
log = require('../log/log')

exports.version = ->
	log.out(packageJSON.version)
