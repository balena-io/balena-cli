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

module.exports =
	signature: 'local promote [deviceIp]'
	description: 'Promote a resinOS device'
	help: '''
		Warning: 'resin promote' requires an openssh-compatible client to be correctly
		installed in your shell environment. For more information (including Windows
		support) please check the README here: https://github.com/resin-io/resin-cli

		Use this command to promote your device.

		Promoting a device will provision it onto the Resin platform,
		converting it from an unmanaged device to a managed device.

		Examples:

			$ resin local promote
			$ resin local promote --port 22222
			$ resin local promote --verbose
	'''
	options: [
				signature: 'verbose'
				boolean: true
				description: 'increase verbosity'
				alias: 'v'
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

		{ forms } = require('resin-sync')
		{ getSubShellCommand } = require('./common')

		options.port ?= 22222

		verbose = if options.verbose then '-vvv' else ''

		Promise.try ->
			return params.deviceIp ?= forms.selectLocalResinOsDevice()
		.then (deviceIp) ->
			_.assign(options, { deviceIp })

			command = "ssh \
				#{verbose} \
				-t \
				-p #{options.port} \
				-o LogLevel=ERROR \
				-o StrictHostKeyChecking=no \
				-o UserKnownHostsFile=/dev/null \
				root@#{options.deviceIp} \
				-- \"resin-provision interactive\""

			subShellCommand = getSubShellCommand(command)
			child_process.spawn subShellCommand.program, subShellCommand.args,
				stdio: 'inherit'
		.nodeify(done)
