_ = require('lodash')
async = require('async')
capitano = require('capitano')
resin = require('resin-sdk')
actions = require('./actions')
errors = require('./errors')
plugins = require('./plugins')

capitano.permission 'user', (done) ->
	resin.auth.isLoggedIn().then (isLoggedIn) ->
		if not isLoggedIn
			throw new Error ('You have to log in')
	.nodeify(done)

capitano.command
	signature: '*'
	action: ->
		capitano.execute(command: 'help')

# ---------- Options ----------
capitano.globalOption
	signature: 'quiet'
	description: 'quiet (no output)'
	boolean: true
	alias: 'q'

capitano.globalOption
	signature: 'project'
	parameter: 'path'
	description: 'project path'
	alias: 'j'

capitano.globalOption
	signature: 'version'
	description: actions.info.version.description
	boolean: true
	alias: 'v'

# We don't do anything in response to this options
# explicitly. We use InquirerJS to provide CLI widgets,
# and that module understands --no-color automatically.
capitano.globalOption
	signature: 'no-color'
	description: 'disable colour highlighting'
	boolean: true

# ---------- Info Module ----------
capitano.command(actions.info.version)
capitano.command(actions.info.config)

# ---------- Help Module ----------
capitano.command(actions.help.help)

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
capitano.command(actions.app.init)
capitano.command(actions.app.info)

# ---------- Device Module ----------
capitano.command(actions.device.list)
capitano.command(actions.device.supported)
capitano.command(actions.device.rename)
capitano.command(actions.device.init)
capitano.command(actions.device.await)
capitano.command(actions.device.info)
capitano.command(actions.device.remove)
capitano.command(actions.device.identify)

# ---------- Notes Module ----------
capitano.command(actions.notes.set)

# ---------- Preferences Module ----------
capitano.command(actions.preferences.preferences)

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

# ---------- Examples Module ----------
capitano.command(actions.examples.list)
capitano.command(actions.examples.clone)
capitano.command(actions.examples.info)

# ---------- Plugins Module ----------
capitano.command(actions.plugin.list)
capitano.command(actions.plugin.install)
capitano.command(actions.plugin.update)
capitano.command(actions.plugin.remove)

changeProjectDirectory = (directory) ->
	try
		process.chdir(directory)
	catch
		errors.handle(new Error("Invalid project: #{directory}"))

async.waterfall([

	(callback) ->
		plugins.register('resin-plugin-', callback)

	(callback) ->
		cli = capitano.parse(process.argv)

		if cli.global.quiet or not process.stdout.isTTY
			console.info = _.noop

		if cli.global.project?
			changeProjectDirectory(cli.global.project)

		if cli.global.version
			actions.info.version.action(null, null, callback)
		else
			capitano.execute(cli, callback)

], errors.handle)
