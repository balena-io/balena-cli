_ = require('lodash')
resin = require('./resin')
packageJSON = require('../package.json')

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
auth = require('./actions/auth')

resin.cli.addCommand('login [username:password]', 'login to resin.io', auth.login)
resin.cli.addCommand('logout', 'logout from resin.io', auth.logout)
resin.cli.addCommand('signup', 'signup to resin.io', auth.signup)

# ---------- App Module ----------
app = require('./actions/app')

resin.cli.addCommand('app:create <name>', 'create a resin.io application', app.create)
resin.cli.addCommand('apps', 'list your applications', app.list)
resin.cli.addCommand('app <id>', 'list a single application', app.info)
resin.cli.addCommand('app:restart <id>', 'restart an application', app.restart)
resin.cli.addCommand('app:rm <id>', 'remove an application', app.remove)

# ---------- Device Module ----------
device = require('./actions/device')

resin.cli.addCommand('devices <id>', 'show devices for an application', device.list)
resin.cli.addCommand('device:rm <id>', 'remove a device', device.remove)
resin.cli.addCommand('device:identify <uuid>', 'identify a device with a UUID', device.identify)

# ---------- Preferences Module ----------
preferences = require('./actions/preferences')

resin.cli.addCommand('preferences', 'open preferences form', preferences.preferences)

# ---------- Keys Module ----------
keys = require('./actions/keys')

resin.cli.addCommand('keys', 'list all SSH keys', keys.list)
resin.cli.addCommand('key <id>', 'list a single SSH key', keys.info)
resin.cli.addCommand('key:rm <id>', 'remove a SSH key', keys.remove)

# ---------- Env Module ----------
env = require('./actions/environment-variables')

resin.cli.addCommand('envs', 'list all environment variables', env.list)
resin.cli.addCommand('env:rm <id>', 'remove environment variable', env.remove)

resin.data.prefix.set resin.config.dataPrefix, (error) ->
	resin.errors.handle(error) if error?

	resin.cli.parse(process.argv)

	quiet = resin.cli.getArgument('quiet')
	resin.log.setQuiet(quiet)
