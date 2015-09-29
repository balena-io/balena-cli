Promise = require('bluebird')
capitano = Promise.promisifyAll(require('capitano'))
mkdirp = Promise.promisify(require('mkdirp'))
resin = require('resin-sdk')
form = require('resin-cli-form')
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
	root: true
	permission: 'user'
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
		.tap ->
			console.log('Your device is ready, lets start pushing some code!')
		.then(patterns.selectProjectDirectory)
		.tap(mkdirp)
		.tap(process.chdir)
		.then ->
			return capitano.runAsync("app associate #{params.name}")
		.then (remoteUrl) ->
			console.log("Resin git remote added: #{remoteUrl}")
			console.log """
				Please type:

					$ cd #{process.cwd()} && git push resin master

				To push your project to resin.io.
			"""
		.nodeify(done)
