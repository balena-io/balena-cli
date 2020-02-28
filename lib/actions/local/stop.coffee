###
Copyright 2017 Balena

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

# A function to reliably execute a command
# in all supported operating systems, including
# different Windows environments like `cmd.exe`
# and `Cygwin` should be encapsulated in a
# re-usable package.
#
module.exports =
	signature: 'local stop [deviceIp]'
	description: 'Stop a running container on a balenaOS device'
	help: '''

		Examples:

			$ balena local stop
			$ balena local stop --app-name myapp
			$ balena local stop --all
			$ balena local stop 192.168.1.10
			$ balena local stop 192.168.1.10 --app-name myapp
	'''
	options: [
			signature: 'all'
			boolean: true
			description: 'stop all containers'
	,
			signature: 'app-name'
			parameter: 'name'
			description: 'name of container to stop'
			alias: 'a'
	]
	root: true
	action: (params, options) ->
		Promise = require('bluebird')
		chalk = require('chalk')
		{ forms, config, BalenaLocalDockerUtils } = require('balena-sync')
		{ selectContainerFromDevice, filterOutSupervisorContainer } = require('./common')

		Promise.try ->
			if not params.deviceIp?
				return forms.selectLocalBalenaOsDevice()
			return params.deviceIp
		.then (@deviceIp) =>
			@docker = new BalenaLocalDockerUtils(@deviceIp)

			if options.all
				# Only list running containers
				return @docker.docker.listContainersAsync(all: false)
				.filter(filterOutSupervisorContainer)
				.then (containers) =>
					Promise.map containers, ({ Names, Id }) =>
						console.log(chalk.yellow.bold("* Stopping container #{Names[0]}"))
						@docker.stopContainer(Id)

			ymlConfig = config.load()
			@appName = options['app-name'] ? ymlConfig['local_balenaos']?['app-name']
			@docker.checkForRunningContainer(@appName)
			.then (isRunning) =>
				if not isRunning
					return selectContainerFromDevice(@deviceIp, true)

				console.log(chalk.yellow.bold("* Stopping container #{@appName}"))
				return @appName
			.then (runningContainerName) =>
				@docker.stopContainer(runningContainerName)
