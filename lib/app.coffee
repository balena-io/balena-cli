_ = require('lodash')
resin = require('./resin')
packageJSON = require('../package.json')
actions = require('./actions')

resin.cli.setVersion(packageJSON.version)

# ---------- Options ----------
resin.cli.addOption('-y, --yes', 'confirm non interactively')
resin.cli.addOption('-v, --verbose', 'increase verbosity')
resin.cli.addOption('-q, --quiet', 'quiet (no output)')
resin.cli.addOption('-t, --type <type>', 'specify a type when creating an application')

# TODO: I have to use 'application' instead of 'app' here
# as Commander gets confused with the app command
resin.cli.addOption('-a, --application <app>', 'application id', _.parseInt)

# ---------- Auth Module ----------
resin.cli.addCommand('login [username:password]', 'login to resin.io', actions.auth.login)
resin.cli.addCommand('logout', 'logout from resin.io', actions.auth.logout)
resin.cli.addCommand('signup', 'signup to resin.io', actions.auth.signup)

# ---------- App Module ----------
resin.cli.addResource('app', 'application', actions.app)
resin.cli.addCommand('app:restart <id>', 'restart an application', actions.app.restart)

# ---------- Device Module ----------
resin.cli.addResource('device', 'device', actions.device)
resin.cli.addCommand('device:identify <uuid>', 'identify a device with a UUID', actions.device.identify)

# ---------- Preferences Module ----------
resin.cli.addCommand('preferences', 'open preferences form', actions.preferences.preferences)

# ---------- Keys Module ----------
resin.cli.addResource('key', 'ssh key', actions.keys)

# ---------- Env Module ----------
resin.cli.addResource('env', 'environment variable', actions.env)

resin.data.prefix.set resin.config.dataPrefix, (error) ->
	resin.errors.handle(error) if error?

	resin.cli.parse(process.argv)

	quiet = resin.cli.getArgument('quiet')
	resin.log.setQuiet(quiet)
