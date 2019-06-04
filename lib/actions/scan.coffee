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

dockerInfoProperties = [
	'Containers'
	'ContainersRunning'
	'ContainersPaused'
	'ContainersStopped'
	'Images'
	'Driver'
	'SystemTime'
	'KernelVersion'
	'OperatingSystem'
	'Architecture'
]

dockerVersionProperties = [
	'Version'
	'ApiVersion'
]

module.exports =
	signature: 'scan'
	description: 'Scan for balenaOS devices in your local network'
	help: '''

		Examples:

			$ balena scan
			$ balena scan --timeout 120
			$ balena scan --verbose
	'''
	options: [
		signature: 'verbose'
		boolean: true
		description: 'Display full info'
		alias: 'v'
	,
		signature: 'timeout'
		parameter: 'timeout'
		description: 'Scan timeout in seconds'
		alias: 't'
	]
	primary: true
	root: true
	action: (params, options, done) ->
		Promise = require('bluebird')
		_ = require('lodash')
		prettyjson = require('prettyjson')
		{ discover } = require('balena-sync')
		{ SpinnerPromise } = require('resin-cli-visuals')
		{ dockerPort, dockerTimeout } = require('./local/common')
		dockerUtils = require('../utils/docker')
		{ exitWithExpectedError } = require('../utils/patterns')

		if options.timeout?
			options.timeout *= 1000

		Promise.try ->
			new SpinnerPromise
				promise: discover.discoverLocalBalenaOsDevices(options.timeout)
				startMessage: 'Scanning for local balenaOS devices..'
				stopMessage: 'Reporting scan results'
		.filter ({ address }) ->
			Promise.try ->
				docker = dockerUtils.createClient(host: address, port: dockerPort, timeout: dockerTimeout)
				docker.pingAsync()
			.return(true)
			.catchReturn(false)
		.tap (devices) ->
			if _.isEmpty(devices)
				exitWithExpectedError('Could not find any balenaOS devices in the local network')
		.map ({ host, address }) ->
			docker = dockerUtils.createClient(host: address, port: dockerPort, timeout: dockerTimeout)
			Promise.props
				dockerInfo: docker.infoAsync().catchReturn('Could not get Docker info')
				dockerVersion: docker.versionAsync().catchReturn('Could not get Docker version')
			.then ({ dockerInfo, dockerVersion }) ->

				if not options.verbose
					dockerInfo = _.pick(dockerInfo, dockerInfoProperties) if _.isObject(dockerInfo)
					dockerVersion = _.pick(dockerVersion, dockerVersionProperties) if _.isObject(dockerVersion)

				return { host, address, dockerInfo, dockerVersion }
		.then (devicesInfo) ->
			console.log(prettyjson.render(devicesInfo, noColor: true))
		.nodeify(done)
