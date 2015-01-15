packageJSON = require('../../package.json')

exports.version = ->
	console.log(packageJSON.version)
