settings = require('resin-settings-client')
packageJSON = require('../../package.json')

exports.version =
	signature: 'version'
	description: 'output the version number'
	help: '''
		Display the Resin CLI version.
	'''
	action: (params, options, done) ->
		console.log(packageJSON.version)
		return done()

exports.config =
	signature: 'config'
	description: 'see your current configuration'
	help: '''
		See your current Resin CLI configuration.

		Configuration lives in $HOME/.resin/config.
	'''
	action: (params, options, done) ->
		for key, value of settings.get()
			console.log("#{key}: #{value}")
		return done()
