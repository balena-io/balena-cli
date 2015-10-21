Promise = require('bluebird')
capitano = Promise.promisifyAll(require('capitano'))
resin = require('resin-sdk')
patterns = require('../utils/patterns')

exports.wizard =
	signature: 'quickstart [name]'
	description: 'getting started with resin.io'
	help: '''
		Use this command to run a friendly wizard to get started with resin.io.

		The wizard will guide you through:

			- Create an application.
			- Initialise an SDCard with the resin.io operating system.
			- Associate an existing project directory with your resin.io application.
			- Push your project to your devices.

		Examples:

			$ sudo resin quickstart
			$ sudo resin quickstart MyApp
	'''
	permission: 'user'
	primary: true
	action: (params, options, done) ->
		Promise.try ->
			return if params.name?
			patterns.selectOrCreateApplication().tap (applicationName) ->
				resin.models.application.has(applicationName).then (hasApplication) ->
					return applicationName if hasApplication
					capitano.runAsync("app create #{applicationName}")
			.then (applicationName) ->
				params.name = applicationName
		.then ->
			return capitano.runAsync("device init --application #{params.name}")
		.tap(patterns.awaitDevice)
		.then (uuid) ->
			return capitano.runAsync("device #{uuid}")
		.then ->
			console.log('Your device is ready, start pushing some code!')
		.nodeify(done)
