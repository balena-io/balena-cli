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
Promise = require('bluebird')
capitano = Promise.promisifyAll(require('capitano'))
resin = require('resin-sdk-preconfigured')
actions = require('./actions')
errors = require('./errors')
events = require('./events')
plugins = require('./utils/plugins')
update = require('./utils/update')

capitano.permission 'user', (done) ->
	resin.auth.isLoggedIn().then (isLoggedIn) ->
		if not isLoggedIn
			throw new Error '''
				You have to log in to continue

				Run the following command to go through the login wizard:

				  $ resin login
			'''
	.nodeify(done)

capitano.command
	signature: '*'
	action: ->
		capitano.execute(command: 'help')

capitano.globalOption
	signature: 'help'
	boolean: true
	alias: 'h'

# ---------- Info Module ----------
capitano.command(actions.info.version)

# ---------- Help Module ----------
capitano.command(actions.help.help)

# ---------- Wizard Module ----------
capitano.command(actions.wizard.wizard)

# ---------- Auth Module ----------
capitano.command(actions.auth.login)
capitano.command(actions.auth.logout)
capitano.command(actions.auth.signup)
capitano.command(actions.auth.whoami)

# ---------- App Module ----------
capitano.command(actions.app.create)
capitano.command(actions.app.list)
capitano.command(actions.app.remove)
capitano.command(actions.app.restart)
capitano.command(actions.app.info)

# ---------- Device Module ----------
capitano.command(actions.device.list)
capitano.command(actions.device.supported)
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
capitano.command(actions.device.info)

# ---------- Notes Module ----------
capitano.command(actions.notes.set)

# ---------- Keys Module ----------
capitano.command(actions.keys.list)
capitano.command(actions.keys.add)
capitano.command(actions.keys.info)
capitano.command(actions.keys.remove)

# ---------- Env Module ----------
capitano.command(actions.env.list)
capitano.command(actions.env.add)
capitano.command(actions.env.rename)
capitano.command(actions.env.remove)

# ---------- OS Module ----------
capitano.command(actions.os.download)
capitano.command(actions.os.configure)
capitano.command(actions.os.initialize)

# ---------- Config Module ----------
capitano.command(actions.config.read)
capitano.command(actions.config.write)
capitano.command(actions.config.inject)
capitano.command(actions.config.reconfigure)
capitano.command(actions.config.generate)

# ---------- Settings Module ----------
capitano.command(actions.settings.list)

# ---------- Logs Module ----------
capitano.command(actions.logs)

# ---------- Sync Module ----------
capitano.command(actions.sync)

# ---------- SSH Module ----------
capitano.command(actions.ssh)

# ---------- Local ResinOS Module ----------
capitano.command(actions.local.configure)
capitano.command(actions.local.flash)
capitano.command(actions.local.logs)
capitano.command(actions.local.promote)
capitano.command(actions.local.push)
capitano.command(actions.local.ssh)
capitano.command(actions.local.scan)
capitano.command(actions.local.stop)

update.notify()

plugins.register(/^resin-plugin-(.+)$/).then ->
	cli = capitano.parse(process.argv)

	events.trackCommand(cli).then ->
		if cli.global?.help
			return capitano.executeAsync(command: "help #{cli.command ? ''}")
		capitano.executeAsync(cli)

.catch(errors.handle)
