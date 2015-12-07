exports.list =
	signature: 'settings'
	description: 'print current settings'
	help: '''
		Use this command to display detected settings

		Examples:

			$ resin settings
	'''
	action: (params, options, done) ->
		resin = require('resin-sdk')
		prettyjson = require('prettyjson')

		resin.settings.getAll()
			.then(prettyjson.render)
			.then(console.log)
			.nodeify(done)
