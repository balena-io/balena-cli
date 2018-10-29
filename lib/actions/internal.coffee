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

# These are internal commands we want to be runnable from the outside
# One use-case for this is spawning the minimal operation with root priviledges

exports.osInit =
	signature: 'internal osinit <image> <type> <config>'
	description: 'do actual init of the device with the preconfigured os image'
	help: '''
		Don't use this command directly! Use `balena os initialize <image>` instead.
	'''
	hidden: true
	root: true
	action: (params, options, done) ->
		Promise = require('bluebird')
		init = require('resin-device-init')
		helpers = require('../utils/helpers')

		return Promise.try ->
			config = JSON.parse(params.config)
			init.initialize(params.image, params.type, config)
		.then(helpers.osProgressHandler)
		.nodeify(done)

exports.scanDevices =
	signature: 'internal scandevices'
	description: 'scan for local balena-enabled devices and show a picker to choose one'
	help: '''
		Don't use this command directly!
	'''
	hidden: true
	root: true
	action: (params, options, done) ->
		Promise = require('bluebird')
		{ forms } = require('balena-sync')

		return Promise.try ->
			forms.selectLocalBalenaOsDevice()
			.then (hostnameOrIp) ->
				console.error("==> Selected device: #{hostnameOrIp}")
		.nodeify(done)

exports.sudo =
	signature: 'internal sudo <command>'
	description: 'execute arbitrary commands in a privileged subprocess'
	help: '''
		Don't use this command directly!

		<command> must be passed as a single argument. That means, you need to make sure
		you enclose <command> in quotes (eg. balena internal sudo 'ls -alF') if for
		whatever reason you invoke the command directly or, typically, pass <command>
		as a single argument to spawn (eg. `spawn('balena', [ 'internal', 'sudo', 'ls -alF' ])`).

		Furthermore, this command will naively split <command> on whitespace and directly
		forward the parts as arguments to `sudo`, so be careful.
	'''
	hidden: true
	action: (params, options, done) ->
		os = require('os')
		Promise = require('bluebird')

		return Promise.try ->
			if os.platform() is 'win32'
				windosu = require('windosu')
				windosu.exec(params.command, {})
			else
				{ spawn } = require('child_process')
				{ wait } = require('rindle')
				cmd = params.command.split(' ')
				ps = spawn('sudo', cmd, stdio: 'inherit', env: process.env)
				wait(ps)

		.nodeify(done)
