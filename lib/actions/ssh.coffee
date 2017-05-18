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

_ = require('lodash')
bash = require('bash')
{ getSubShellCommand } = require('../utils/helpers')

module.exports =
	signature: 'ssh [uuid]'
	description: '(beta) get a shell into the running app container of a device'
	help: '''
		Warning: 'resin ssh' requires an openssh-compatible client to be correctly
		installed in your shell environment. For more information (including Windows
		support) please check the README here: https://github.com/resin-io/resin-cli

		Use this command to get a shell into the running application container of
		your device.

		Examples:

			$ resin ssh MyApp
			$ resin ssh 7cf02a6
			$ resin ssh 7cf02a6 --port 8080
			$ resin ssh 7cf02a6 -v
	'''
	permission: 'user'
	primary: true
	options: [
			signature: 'port'
			parameter: 'port'
			description: 'ssh gateway port'
			alias: 'p'
	,
			signature: 'verbose'
			boolean: true
			description: 'increase verbosity'
			alias: 'v'
	,
			signature: 'noproxy'
			boolean: true
			description: "don't use the proxy configuration for this connection.
				Only makes sense if you've configured proxy globally."
	]
	action: (params, options, done) ->
		child_process = require('child_process')
		Promise = require('bluebird')
		resin = require('resin-sdk-preconfigured')
		patterns = require('../utils/patterns')

		options.port ?= 22

		verbose = if options.verbose then '-vvv' else ''

		Promise.try ->
			return false if not params.uuid
			return resin.models.device.has(params.uuid)
		.then (uuidExists) ->
			return params.uuid if uuidExists
			return patterns.inferOrSelectDevice()
		.then (uuid) ->
			console.info("Connecting to: #{uuid}")
			resin.models.device.get(uuid)
		.then (device) ->
			throw new Error('Device is not online') if not device.is_online

			Promise.props
				username: resin.auth.whoami()
				uuid: device.uuid
				# get full uuid
				containerId: resin.models.device.getApplicationInfo(device.uuid).get('containerId')
				proxyUrl: resin.settings.get('proxyUrl')
			.then ({ username, uuid, containerId, proxyUrl }) ->
				throw new Error('Did not find running application container') if not containerId?
				Promise.try ->
					sshProxyCommand = ''

					proxyConfig = global.PROXY_CONFIG
					if proxyConfig and not options.noproxy
						tunnelOptions =
							proxy: "#{proxyConfig.host}:#{proxyConfig.port}"
							dest: '%h:%p'
						{ proxyAuth } = proxyConfig
						if proxyAuth
							i = proxyAuth.indexOf(':')
							_.assign tunnelOptions,
								user: proxyAuth.substring(0, i)
								pass: proxyAuth.substring(i + 1)
						proxyCommand = "proxytunnel #{bash.args(tunnelOptions, '--', '=')}"
						sshProxyCommand = "-o #{bash.args({ ProxyCommand: proxyCommand }, '', '=')}"

					command = "ssh #{verbose} -t \
						-o LogLevel=ERROR \
						-o StrictHostKeyChecking=no \
						-o UserKnownHostsFile=/dev/null \
						-o ControlMaster=no \
						#{sshProxyCommand} \
						-p #{options.port} #{username}@ssh.#{proxyUrl} enter #{uuid} #{containerId}"

					subShellCommand = getSubShellCommand(command)
					child_process.spawn subShellCommand.program, subShellCommand.args,
						stdio: 'inherit'
		.nodeify(done)
