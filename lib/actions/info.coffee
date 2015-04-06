packageJSON = require('../../package.json')

exports.version =
	signature: 'version'
	description: 'output the version number'
	help: '''
		Display the Resin CLI version.
	'''
	action: ->
		console.log(packageJSON.version)
