###
Copyright 2016-2019 Balena

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

Promise = require('bluebird')
capitano = require('capitano')
actions = require('./actions')
events = require('./events')

capitano.permission 'user', (done) ->
	require('./utils/patterns').exitIfNotLoggedIn()
	.then(done, done)

capitano.command
	signature: '*'
	action: (params, options, done) ->
		capitano.execute(command: 'help', done)
		process.exitCode = process.exitCode || 1

capitano.globalOption
	signature: 'help'
	boolean: true
	alias: 'h'

capitano.globalOption
	signature: 'version'
	boolean: true
	alias: 'v'

# ---------- Help Module ----------
capitano.command(actions.help.help)

# ---------- Api key module ----------
capitano.command(actions.apiKey.generate)

# ---------- App Module ----------
capitano.command(actions.app.create)
capitano.command(actions.app.list)
capitano.command(actions.app.remove)
capitano.command(actions.app.restart)
capitano.command(actions.app.info)

# ---------- Auth Module ----------
capitano.command(actions.auth.login)
capitano.command(actions.auth.logout)
capitano.command(actions.auth.whoami)

# ---------- Device Module ----------
capitano.command(actions.device.list)
capitano.command(actions.device.rename)
capitano.command(actions.device.init)
capitano.command(actions.device.remove)
capitano.command(actions.device.identify)
capitano.command(actions.device.reboot)
capitano.command(actions.device.shutdown)
capitano.command(actions.device.enableDeviceUrl)
capitano.command(actions.device.disableDeviceUrl)
capitano.command(actions.device.getDeviceUrl)
capitano.command(actions.device.hasDeviceUrl)
capitano.command(actions.device.register)
capitano.command(actions.device.move)
capitano.command(actions.device.osUpdate)
capitano.command(actions.device.info)

# ---------- Keys Module ----------
capitano.command(actions.keys.list)
capitano.command(actions.keys.add)
capitano.command(actions.keys.info)
capitano.command(actions.keys.remove)

# ---------- Tags Module ----------
capitano.command(actions.tags.list)
capitano.command(actions.tags.set)
capitano.command(actions.tags.remove)

# ---------- OS Module ----------
capitano.command(actions.os.versions)
capitano.command(actions.os.download)
capitano.command(actions.os.buildConfig)
capitano.command(actions.os.initialize)

# ---------- Config Module ----------
capitano.command(actions.config.read)
capitano.command(actions.config.write)
capitano.command(actions.config.inject)
capitano.command(actions.config.reconfigure)
capitano.command(actions.config.generate)

# ---------- Logs Module ----------
capitano.command(actions.logs.logs)

# ---------- Tunnel Module ----------
capitano.command(actions.tunnel.tunnel)

# ---------- Preload Module ----------
capitano.command(actions.preload)

# ---------- SSH Module ----------
capitano.command(actions.ssh.ssh)

# ---------- Local balenaOS Module ----------
capitano.command(actions.local.configure)
capitano.command(actions.local.flash)
capitano.command(actions.scan)

# ---------- Public utils ----------
capitano.command(actions.util.availableDrives)

# ---------- Internal utils ----------
capitano.command(actions.internal.osInit)
capitano.command(actions.internal.scanDevices)

#------------ Local build and deploy -------
capitano.command(actions.build)
capitano.command(actions.deploy)

#------------ Push/remote builds -------
capitano.command(actions.push.push)

#------------ Join/Leave -------
capitano.command(actions.join.join)
capitano.command(actions.leave.leave)

exports.run = (argv) ->
	cli = capitano.parse(argv.slice(2))
	runCommand = ->
		capitanoExecuteAsync = Promise.promisify(capitano.execute)
		if cli.global?.help
			capitanoExecuteAsync(command: "help #{cli.command ? ''}")
		else
			capitanoExecuteAsync(cli)

	trackCommand = ->
		getMatchCommandAsync = Promise.promisify(capitano.state.getMatchCommand)
		getMatchCommandAsync(cli.command)
		.then (command) ->
			# cmdSignature is literally a string like, for example:
			#     "push <applicationOrDevice>"
			# ("applicationOrDevice" is NOT replaced with its actual value)
			# In case of failures like an inexistent or invalid command,
			# command.signature.toString() returns '*'
			cmdSignature = command.signature.toString()
			events.trackCommand(cmdSignature)

	Promise.all([trackCommand(), runCommand()])
	.catch(require('./errors').handleError)
