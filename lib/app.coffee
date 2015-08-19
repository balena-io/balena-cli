_ = require('lodash')
Promise = require('bluebird')
capitano = Promise.promisifyAll(require('capitano'))
resin = require('resin-sdk')
actions = require('./actions')
errors = require('./errors')
plugins = require('./utils/plugins')
update = require('./utils/update')

capitano.permission 'user', (done) ->
	resin.auth.isLoggedIn().then (isLoggedIn) ->
		if not isLoggedIn
			throw new Error ('You have to log in')
	.nodeify(done)

capitano.command
	signature: '*'
	action: ->
		capitano.execute(command: 'help')

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
capitano.command(actions.app.associate)
capitano.command(actions.app.info)

# ---------- Device Module ----------
capitano.command(actions.device.list)
capitano.command(actions.device.rename)
capitano.command(actions.device.init)
capitano.command(actions.device.await)
capitano.command(actions.device.info)
capitano.command(actions.device.remove)
capitano.command(actions.device.identify)

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

# ---------- Logs Module ----------
capitano.command(actions.logs)

update.notify()

plugins.register(/^resin-plugin-(.+)$/).then ->
	cli = capitano.parse(process.argv)
	capitano.executeAsync(cli)
.catch(errors.handle)
