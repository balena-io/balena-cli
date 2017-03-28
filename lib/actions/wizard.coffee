###
Copyright 2016 Resin.io

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
###

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

			$ resin quickstart
			$ resin quickstart MyApp
	'''
	primary: true
	action: (params, options, done) ->
		Promise = require('bluebird')
		capitanoRunAsync = Promise.promisify(require('capitano').run)
		resin = require('resin-sdk-preconfigured')
		patterns = require('../utils/patterns')

		resin.auth.isLoggedIn().then (isLoggedIn) ->
			return if isLoggedIn
			console.info('Looks like you\'re not logged in yet!')
			console.info('Lets go through a quick wizard to get you started.\n')
			return capitanoRunAsync('login')
		.then ->
			return if params.name?
			patterns.selectOrCreateApplication().tap (applicationName) ->
				resin.models.application.has(applicationName).then (hasApplication) ->
					return applicationName if hasApplication
					capitanoRunAsync("app create #{applicationName}")
			.then (applicationName) ->
				params.name = applicationName
		.then ->
			return capitanoRunAsync("device init --application #{params.name}")
		.tap(patterns.awaitDevice)
		.then (uuid) ->
			return capitanoRunAsync("device #{uuid}")
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
