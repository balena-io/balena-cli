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

# TODO: A function to reliably execute a command
# in all supported operating systems, including
# different Windows environments like `cmd.exe`
# and `Cygwin` should be encapsulated in a
# re-usable package.
# This is literally copy-pasted from the `resin-sync`
# module.
getSubShellCommand = (command) ->
	os = require('os')

	if os.platform() is 'win32'
		return {
			program: 'cmd.exe'
			args: [ '/s', '/c', command ]
		}
	else
		return {
			program: '/bin/sh'
			args: [ '-c', command ]
		}

module.exports =
	signature: 'ssh <uuid>'
	description: '(beta) get a shell into the running app container of a device'
	help: '''
		Use this command to get a shell into the running application container of
		your device.

		Examples:

			$ resin ssh 7cf02a6
			$ resin ssh 7cf02a6 --port 8080
	'''
	permission: 'user'
	primary: true
	options: [
			signature: 'port'
			parameter: 'port'
			description: 'ssh gateway port'
			alias: 't'
	]
	action: (params, options, done) ->
		child_process = require('child_process')
		Promise = require 'bluebird'
		resin = require('resin-sdk')
		settings = require('resin-settings-client')

		if not options.port?
			options.port = 22

		console.info("Connecting with: #{params.uuid}")

		Promise.props
			isOnline: resin.models.device.isOnline(params.uuid)
			username: resin.auth.whoami()
			uuid: resin.models.device.get(params.uuid).get('uuid') # get full uuid
			containerId: resin.models.device.getApplicationInfo(params.uuid).get('containerId')
		.then ({ isOnline, username, uuid, containerId }) ->
			throw new Error('Device is not online') if not isOnline
			throw new Error('Did not find running application container') if not containerId?
			Promise.try ->
				command = "ssh -t -o LogLevel=ERROR -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
					-p #{options.port} #{username}@ssh.#{settings.get('proxyUrl')} enter #{uuid} #{containerId}"

				subShellCommand = getSubShellCommand(command)
				spawn = child_process.spawn subShellCommand.program, subShellCommand.args,
					stdio: 'inherit'
		.nodeify(done)
