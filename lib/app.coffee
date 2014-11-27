_ = require('lodash')
resin = require('./resin')
packageJSON = require('../package.json')
actions = require('./actions')

resin.cli.setVersion(packageJSON.version)

# ---------- Options ----------
resin.cli.addOption
	option: '-y, --yes'
	description: 'confirm non interactively'

resin.cli.addOption
	option: '-v, --verbose'
	description: 'increase verbosity'

resin.cli.addOption
	option: '-q, --quiet'
	description: 'quiet (no output)'

resin.cli.addOption
	option: '-t, --type <type>'
	description: 'specify a type when creating an application'

# TODO: I have to use 'application' instead of 'app' here
# as Commander gets confused with the app command
resin.cli.addOption
	option: '-a, --application <app>'
	description: 'application id'
	coerce: _.parseInt

# ---------- Auth Module ----------
resin.cli.addCommand
	command: 'login [username:password]'
	description: 'login to resin.io'
	action: actions.auth.login

resin.cli.addCommand
	command: 'logout'
	description: 'logout from resin.io'
	action: actions.auth.logout

resin.cli.addCommand
	command: 'signup'
	description: 'signup to resin.io'
	action: actions.auth.signup

# ---------- App Module ----------
resin.cli.addResource
	name: 'app'
	displayName: 'application'
	actions: actions.app

resin.cli.addCommand
	command: 'app:restart <id>'
	description: 'restart an application'
	action: actions.app.restart

# ---------- Device Module ----------
resin.cli.addResource
	name: 'device'
	displayName: 'device'
	actions: actions.device

resin.cli.addCommand
	command: 'device:identify <uuid>'
	description: 'identify a device with a UUID'
	action: actions.device.identify

# ---------- Preferences Module ----------
resin.cli.addCommand
	command: 'preferences'
	description: 'open preferences form'
	action: actions.preferences.preferences

# ---------- Keys Module ----------
resin.cli.addResource
	name: 'key'
	displayName: 'ssh key'
	actions: actions.keys

# ---------- Env Module ----------
resin.cli.addResource
	name: 'env'
	displayName: 'environment variable'
	actions: actions.env

resin.data.prefix.set resin.config.dataPrefix, (error) ->
	resin.errors.handle(error) if error?

	resin.cli.parse(process.argv)

	quiet = resin.cli.getArgument('quiet')
	resin.log.setQuiet(quiet)
