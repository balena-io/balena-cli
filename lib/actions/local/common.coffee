Promise = require('bluebird')
_ = require('lodash')
form = require('resin-cli-form')
chalk = require('chalk')

dockerUtils = require('../../utils/docker')
{ exitWithExpectedError } = require('../../utils/patterns')

exports.dockerPort = dockerPort = 2375
exports.dockerTimeout = dockerTimeout = 2000

exports.filterOutSupervisorContainer = filterOutSupervisorContainer = (container) ->
	for name in container.Names
		return false if name.includes('resin_supervisor')
	return true

exports.selectContainerFromDevice = Promise.method (deviceIp, filterSupervisor = false) ->
	docker = dockerUtils.createClient(host: deviceIp, port: dockerPort, timeout: dockerTimeout)

	# List all containers, including those not running
	docker.listContainersAsync(all: true)
	.filter (container) ->
		return true if not filterSupervisor
		filterOutSupervisorContainer(container)
	.then (containers) ->
		if _.isEmpty(containers)
			exitWithExpectedError("No containers found in #{deviceIp}")

		return form.ask
			message: 'Select a container'
			type: 'list'
			choices: _.map containers, (container) ->
				containerName = container.Names[0] or 'Untitled'
				shortContainerId = ('' + container.Id).substr(0, 11)

				return {
					name: "#{containerName} (#{shortContainerId})"
					value: container.Id
				}

exports.pipeContainerStream = Promise.method ({ deviceIp, name, outStream, follow = false }) ->
	docker = dockerUtils.createClient(host: deviceIp, port: dockerPort)

	container = docker.getContainer(name)
	container.inspectAsync()
	.then (containerInfo) ->
		return containerInfo?.State?.Running
	.then (isRunning) ->
		container.attachAsync
			logs: not follow or not isRunning
			stream: follow and isRunning
			stdout: true
			stderr: true
	.then (containerStream) ->
		containerStream.pipe(outStream)
	.catch (err) ->
		err = '' + err.statusCode
		if err is '404'
			return console.log(chalk.red.bold("Container '#{name}' not found."))
		throw err

exports.getSubShellCommand = require('../../utils/helpers').getSubShellCommand
