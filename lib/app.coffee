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
resin.cli.addCommand('app:create <name>', 'create a resin.io application', actions.app.create)
resin.cli.addCommand('apps', 'list your applications', actions.app.list)
resin.cli.addCommand('app <id>', 'list a single application', actions.app.info)
resin.cli.addCommand('app:restart <id>', 'restart an application', actions.app.restart)
resin.cli.addCommand('app:rm <id>', 'remove an application', actions.app.remove)

# ---------- Device Module ----------
resin.cli.addCommand('devices <id>', 'show devices for an application', actions.device.list)
resin.cli.addCommand('device:rm <id>', 'remove a device', actions.device.remove)
resin.cli.addCommand('device:identify <uuid>', 'identify a device with a UUID', actions.device.identify)

# ---------- Preferences Module ----------
resin.cli.addCommand('preferences', 'open preferences form', actions.preferences.preferences)

# ---------- Keys Module ----------
resin.cli.addCommand('keys', 'list all SSH keys', actions.keys.list)
resin.cli.addCommand('key <id>', 'list a single SSH key', actions.keys.info)
resin.cli.addCommand('key:rm <id>', 'remove a SSH key', actions.keys.remove)

# ---------- Env Module ----------
resin.cli.addCommand('envs', 'list all environment variables', actions.env.list)
resin.cli.addCommand('env:rm <id>', 'remove environment variable', actions.env.remove)

resin.data.prefix.set resin.config.dataPrefix, (error) ->
	resin.errors.handle(error) if error?

	resin.cli.parse(process.argv)

	quiet = resin.cli.getArgument('quiet')
	resin.log.setQuiet(quiet)
