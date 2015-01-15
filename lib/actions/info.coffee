packageJSON = require('../../package.json')

exports.version =
	signature: 'version'
	description: 'output the version number'
	action: ->
		console.log(packageJSON.version)
