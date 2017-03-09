###
Copyright 2017 Resin.io

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
	signature: 'local scan'
	description: 'Scan for resinOS devices in your local network'
	help: '''

		Examples:

			$ resin local scan
			$ resin local scan --timeout 120
			$ resin local scan --verbose
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
	action: (params, options, done) ->
		Promise = require('bluebird')
		_ = require('lodash')
		prettyjson = require('prettyjson')
		Docker = require('docker-toolbelt')
		{ discover } = require('resin-sync')
		{ SpinnerPromise } = require('resin-cli-visuals')

		if options.timeout?
			options.timeout *= 1000

		Promise.try ->
			new SpinnerPromise
				promise: discover.discoverLocalResinOsDevices(options.timeout)
				startMessage: 'Scanning for local resinOS devices..'
				stopMessage: 'Reporting scan results'
		.filter ({ address }) ->
			docker = new Docker(host: address, port: 2375)
			docker.infoAsync().return(true).catchReturn(false)
		.tap (devices) ->
			if _.isEmpty(devices)
				throw new Error('Could not find any resinOS devices in the local network')
		.map ({ host, address }) ->
			docker = new Docker(host: address, port: 2375)
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
