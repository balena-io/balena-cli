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
	signature: 'local logs [deviceIp]'
	description: 'Get or attach to logs of a running container on a balenaOS device'
	help: '''

		Examples:

			$ balena local logs
			$ balena local logs -f
			$ balena local logs 192.168.1.10
			$ balena local logs 192.168.1.10 -f
			$ balena local logs 192.168.1.10 -f --app-name myapp
	'''
	options: [
			signature: 'follow'
			boolean: true
			description: 'follow log'
			alias: 'f'
	,
			signature: 'app-name'
			parameter: 'name'
			description: 'name of container to get logs from'
			alias: 'a'
	]
	root: true
	action: (params, options, done) ->
		Promise = require('bluebird')
		{ forms } = require('balena-sync')
		{ selectContainerFromDevice, pipeContainerStream } = require('./common')

		Promise.try ->
			if not params.deviceIp?
				return forms.selectLocalBalenaOsDevice()
			return params.deviceIp
		.then (@deviceIp) =>
			if not options['app-name']?
				return selectContainerFromDevice(@deviceIp)
			return options['app-name']
		.then (appName) =>
			pipeContainerStream
				deviceIp: @deviceIp
				name: appName
				outStream: process.stdout
				follow: options['follow']
