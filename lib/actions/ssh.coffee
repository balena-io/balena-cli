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

commandOptions = require('./command-options')
{ normalizeUuidProp } = require('../utils/normalization')

module.exports =
	signature: 'ssh [uuid] [command]'
	description: '(beta) get a shell into the host OS or running app container of a device'
	help: '''
		Warning: 'balena ssh' requires an openssh-compatible client to be correctly
		installed in your shell environment. For more information (including Windows
		support) please check the README here: https://github.com/balena-io/balena-cli

		Use this command to get a shell into the running application container of
		your device, and you can also run commands in the host OS

		Examples:

			$ balena ssh MyApp
			$ balena ssh 7cf02a6
			$ balena ssh 7cf02a6 --port 8080
			$ balena ssh 7cf02a6 -v
			$ balena ssh 7cf02a6 -s
			$ balena ssh 7cf02a6 'date' -s
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
	commandOptions.hostOSAccess,
			signature: 'noproxy'
			boolean: true
			description: "don't use the proxy configuration for this connection.
				Only makes sense if you've configured proxy globally."
	]
	action: (params, options, done) ->
		normalizeUuidProp(params)
		child_process = require('child_process')
		Promise = require('bluebird')
		balena = require('balena-sdk').fromSharedOptions()
		_ = require('lodash')
		bash = require('bash')
		hasbin = require('hasbin')
		{ getSubShellCommand } = require('../utils/helpers')
		patterns = require('../utils/patterns')

		options.port ?= 22

		verbose = if options.verbose then '-vvv' else ''

		proxyConfig = global.PROXY_CONFIG
		useProxy = !!proxyConfig and not options.noproxy

		getSshProxyCommand = (hasTunnelBin) ->
			return '' if not useProxy

			if not hasTunnelBin
				console.warn('''
					Proxy is enabled but the `proxytunnel` binary cannot be found.
					Please install it if you want to route the `balena ssh` requests through the proxy.
					Alternatively you can pass `--noproxy` param to the `balena ssh` command to ignore the proxy config
					for the `ssh` requests.

					Attemmpting the unproxied request for now.
				''')
				return ''

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
			return "-o #{bash.args({ ProxyCommand: proxyCommand }, '', '=')}"

		Promise.try ->
			return false if not params.uuid
			return balena.models.device.has(params.uuid)
		.then (uuidExists) ->
			return params.uuid if uuidExists
			return patterns.inferOrSelectDevice()
		.then (uuid) ->
			console.info("Connecting to: #{uuid}")
			balena.models.device.get(uuid)
		.then (device) ->
			patterns.exitWithExpectedError('Device is not online') if not device.is_online

			Promise.props
				username: balena.auth.whoami()
				uuid: device.uuid
				# get full uuid
				containerId: if options.host then '' else balena.models.device.getApplicationInfo(device.uuid).get('containerId')
				proxyUrl: balena.settings.get('proxyUrl')

				hasTunnelBin: if useProxy then hasbin('proxytunnel') else null
			.then ({ username, uuid, containerId, proxyUrl, hasTunnelBin }) ->
				throw new Error('Did not find running application container') if not containerId?
				Promise.try ->
					sshProxyCommand = getSshProxyCommand(hasTunnelBin)
					sshCommand = ''

					console
					if options.host
						accessCommand = "host #{uuid}"
						if params.command
							# Quote the command so it doesn't get broken up by the SSH connection
							sshCommand = "'#{params.command}'"
					else
						accessCommand = "enter #{uuid} #{containerId}"


					command = "ssh #{verbose} -t \
						-o LogLevel=ERROR \
						-o StrictHostKeyChecking=no \
						-o UserKnownHostsFile=/dev/null \
						#{sshProxyCommand} \
						-p #{options.port} #{username}@ssh.#{proxyUrl} #{accessCommand} \
						#{sshCommand}"

					subShellCommand = getSubShellCommand(command)
					child_process.spawn subShellCommand.program, subShellCommand.args,
						stdio: 'inherit'
					.on 'exit', (code) ->
						if code isnt 0
							process.exit code
		.nodeify(done)
