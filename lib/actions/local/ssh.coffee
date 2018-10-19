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

{ hostOSAccess } = require('../command-options')
_ = require('lodash')

localHostOSAccessOption = _.cloneDeep(hostOSAccess)
localHostOSAccessOption.description = 'get a shell into the host OS'

module.exports =
	signature: 'local ssh [deviceIp]'
	description: 'Get a shell into a balenaOS device'
	help: '''
		Warning: 'balena local ssh' requires an openssh-compatible client to be correctly
		installed in your shell environment. For more information (including Windows
		support) please check the README here: https://github.com/balena-io/balena-cli

		Use this command to get a shell into the running application container of
		your device.

		The '--host' option will get you a shell into the Host OS of the balenaOS device.
		No option will return a list of containers to enter or you can explicitly select
		one by passing its name to the --container option

		Examples:

			$ balena local ssh
			$ balena local ssh --host
			$ balena local ssh --container chaotic_water
			$ balena local ssh --container chaotic_water --port 22222
			$ balena local ssh --verbose
	'''
	options: [
			signature: 'verbose'
			boolean: true
			description: 'increase verbosity'
			alias: 'v'
	,
	localHostOSAccessOption,
			signature: 'container'
			parameter: 'container'
			default: null
			description: 'name of container to access'
			alias: 'c'
	,
			signature: 'port'
			parameter: 'port'
			description: 'ssh port number (default: 22222)'
			alias: 'p'
	]
	root: true
	action: (params, options, done) ->
		child_process = require('child_process')
		Promise = require 'bluebird'
		_ = require('lodash')
		{ forms } = require('balena-sync')

		{ selectContainerFromDevice, getSubShellCommand } = require('./common')
		{ exitWithExpectedError } = require('../../utils/patterns')

		if (options.host is true and options.container?)
			exitWithExpectedError('Please pass either --host or --container option')

		if not options.port?
			options.port = 22222

		verbose = if options.verbose then '-vvv' else ''

		Promise.try ->
			if not params.deviceIp?
				return forms.selectLocalBalenaOsDevice()
			return params.deviceIp
		.then (deviceIp) ->
			_.assign(options, { deviceIp })

			return if options.host

			if not options.container?
				return selectContainerFromDevice(deviceIp)

			return options.container
		.then (container) ->

			command = "ssh \
				#{verbose} \
				-t \
				-p #{options.port} \
				-o LogLevel=ERROR \
				-o StrictHostKeyChecking=no \
				-o UserKnownHostsFile=/dev/null \
				 root@#{options.deviceIp}"

			if not options.host
				shellCmd = '''/bin/sh -c $"'if [ -e /bin/bash ]; then exec /bin/bash; else exec /bin/sh; fi'"'''
				dockerCmd = "'$(if [ -f /usr/bin/balena ]; then echo \"balena\"; else echo \"docker\"; fi)'"
				command += " #{dockerCmd} exec -ti #{container} #{shellCmd}"

			subShellCommand = getSubShellCommand(command)
			child_process.spawn subShellCommand.program, subShellCommand.args,
				stdio: 'inherit'
		.nodeify(done)
