_ = require('lodash')
Promise = require('bluebird')
capitano = Promise.promisifyAll(require('capitano'))
path = require('path')
mkdirp = require('mkdirp')
userHome = require('user-home')
visuals = require('resin-cli-visuals')
async = require('async')
resin = require('resin-sdk')
form = require('resin-cli-form')

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
		async.waterfall [

			(callback) ->
				return callback() if params.name?

				# TODO: Move this whole routine to Resin CLI Visuals
				async.waterfall [

					(callback) ->
						resin.models.application.hasAny().nodeify(callback)

					(hasAnyApplications, callback) ->
						return callback(null, null) if not hasAnyApplications

						async.waterfall [

							(callback) ->
								resin.models.application.getAll().nodeify(callback)

							(applications, callback) ->
								applications = _.pluck(applications, 'app_name')
								applications.unshift
									name: 'Create a new application'
									value: null

								form.ask
									message: 'Select an application'
									type: 'list'
									choices: applications
								.nodeify(callback)

						], callback

					(application, callback) ->
						return callback(null, application) if application?

						form.ask
							message: 'Choose a Name for your new application'
							type: 'input'
						.then (applicationName) ->
							capitano.runAsync("app create #{applicationName}").return(applicationName)
						.nodeify(callback)

					(applicationName, callback) ->
						params.name = applicationName
						return callback()

				], callback

			(callback) ->
				capitano.run("device init --application #{params.name}", callback)

			(deviceUuid, callback) ->
				params.uuid = deviceUuid
				resin.models.device.getName(params.uuid).then (deviceName) ->
					params.deviceName = deviceName
					console.log("Waiting for #{params.deviceName} to connect to resin...")
					capitano.runAsync("device await #{params.uuid}").return(callback)
				.nodeify(callback)

			(callback) ->
				console.log("The device #{params.deviceName} successfully connected to resin!")
				console.log('')
				capitano.run("device #{params.uuid}", callback)

			(callback) ->
				console.log('Your device is ready, lets start pushing some code!')
				form.ask
					message: 'Please choose a directory for your code'
					type: 'input'

					# TODO: Move this to resin-settings-client.
					default: path.join(userHome, 'ResinProjects', params.name)
				.nodeify(callback)

			(directoryName, callback) ->
				params.directory = directoryName
				mkdirp(directoryName, callback)

			(made, callback) ->
				console.log("Associating #{params.name} with #{params.directory}...")
				process.chdir(params.directory)
				capitano.run("app associate #{params.name}", callback)

			(remoteUrl, callback) ->
				console.log("Resin git remote added: #{remoteUrl}")
				console.log('Please type "git push resin master" into your project directory now!')
				return callback()

		], done
