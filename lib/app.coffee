_ = require('lodash')
path = require('path')
capitano = require('capitano')
resin = require('resin-sdk')
nplugm = require('nplugm')
actions = require('./actions')
errors = require('./errors')
plugins = require('./plugins')

capitano.permission 'user', (done) ->
	resin.auth.isLoggedIn (isLoggedIn) ->
		if not isLoggedIn
			return done(new Error('You have to log in'))
		return done()

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

# We don't do anything in response to this options
# explicitly. We use InquirerJS to provide CLI widgets,
# and that module understands --no-color automatically.
capitano.globalOption
	signature: 'no-color'
	description: 'disable colour highlighting'
	boolean: true

# ---------- Info Module ----------
capitano.command(actions.info.version)

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
capitano.command(actions.app.info)
capitano.command(actions.app.remove)
capitano.command(actions.app.restart)
capitano.command(actions.app.init)

# ---------- Device Module ----------
capitano.command(actions.device.list)
capitano.command(actions.device.supported)
capitano.command(actions.device.rename)
capitano.command(actions.device.init)
capitano.command(actions.device.info)
capitano.command(actions.device.remove)
capitano.command(actions.device.identify)

# ---------- Drive Module ----------
capitano.command(actions.drive.list)

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
capitano.command(actions.logs.logs)

# ---------- OS Module ----------
capitano.command(actions.os.download)
capitano.command(actions.os.install)

# ---------- Examples Module ----------
capitano.command(actions.examples.list)
capitano.command(actions.examples.clone)
capitano.command(actions.examples.info)

changeProjectDirectory = (directory) ->
	try
		process.chdir(directory)
	catch
		errors.handle(new Error("Invalid project: #{directory}"))

plugins.register 'resin-plugin-*', (error, loadedPlugins) ->

	errors.handle(error) if error?

	cli = capitano.parse(process.argv)

	resin.data.prefix.set resin.settings.get('dataPrefix'), (error) ->
		errors.handle(error) if error?

		if cli.global.quiet
			console.info = _.noop

		if cli.global.project?
			changeProjectDirectory(cli.global.project)

		capitano.execute cli, (error) ->
			errors.handle(error) if error?
