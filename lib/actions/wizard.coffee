###
Copyright 2016-2017 Balena

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
	description: 'getting started with balena'
	help: '''
		Use this command to run a friendly wizard to get started with balena.

		The wizard will guide you through:

			- Create an application.
			- Initialise an SDCard with the balena operating system.
			- Associate an existing project directory with your balena application.
			- Push your project to your devices.

		Examples:

			$ balena quickstart
			$ balena quickstart MyApp
	'''
	primary: true
	action: (params, options, done) ->
		balena = require('balena-sdk').fromSharedOptions()
		patterns = require('../utils/patterns')
		{ runCommand } = require('../utils/helpers')

		balena.auth.isLoggedIn().then (isLoggedIn) ->
			return if isLoggedIn
			console.info('Looks like you\'re not logged in yet!')
			console.info("Let's go through a quick wizard to get you started.\n")
			return runCommand('login')
		.then ->
			return if params.name?
			patterns.selectOrCreateApplication().tap (applicationName) ->
				balena.models.application.has(applicationName).then (hasApplication) ->
					return applicationName if hasApplication
					runCommand("app create #{applicationName}")
			.then (applicationName) ->
				params.name = applicationName
		.then ->
			return runCommand("device init --application #{params.name}")
		.tap(patterns.awaitDevice)
		.then (uuid) ->
			return runCommand("device #{uuid}")
		.then ->
			return balena.models.application.get(params.name)
		.then (application) ->
			console.log """
				Your device is ready to start pushing some code!

				Check our official documentation for more information:

				    http://balena.io/docs/#/pages/introduction/introduction.md

				Clone an example or go to an existing application directory and run:

				    $ git remote add balena #{application.git_repository}
				    $ git push balena master
			"""
		.nodeify(done)
