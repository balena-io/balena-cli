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
		Promise = require('bluebird')
		capitano = Promise.promisifyAll(require('capitano'))
		resin = require('resin-sdk')
		patterns = require('../utils/patterns')

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
			return resin.models.application.get(params.name)
		.then (application) ->
			console.log """
				Your device is ready to start pushing some code!

				Check our official documentation for more information:

				    http://docs.resin.io/#/pages/introduction/introduction.md

				Clone an example or go to an existing application directory and run:

				    $ git remote add resin #{application.git_repository}
				    $ git push resin master
			"""
		.nodeify(done)
