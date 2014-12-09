_ = require('lodash')
resin = require('./resin')
packageJSON = require('../package.json')
actions = require('./actions')
cli = require('./cli/cli')

cli.setVersion(packageJSON.version)

# ---------- Options ----------
cli.addOption
	option: '-y, --yes'
	description: 'confirm non interactively'

cli.addOption
	option: '-v, --verbose'
	description: 'increase verbosity'

cli.addOption
	option: '-q, --quiet'
	description: 'quiet (no output)'

cli.addOption
	option: '-t, --type <type>'
	description: 'specify a type when creating an application'

cli.addOption
	option: '-n, --num <num>'
	description: 'number of lines to display'

cli.addOption
	option: '--tail'
	description: 'continuously stream output'

# TODO: I have to use 'application' instead of 'app' here
# as Commander gets confused with the app command
cli.addOption
	option: '-a, --application <app>'
	description: 'application id'
	coerce: _.parseInt

cli.addOption
	option: '-w, --network <network>'
	description: 'network type when downloading OS'

cli.addOption
	option: '-s, --wifi-ssid <wifiSsid>'
	description: 'wifi ssid, if network is wifi'

cli.addOption
	option: '-k, --wifi-key <wifiKey>'
	description: 'wifi key, if network is wifi'

cli.addOption
	option: '-o, --output <output>'
	description: 'output file'

# ---------- Auth Module ----------
cli.addCommand
	command: 'login [username:password]'
	description: 'login to resin.io'
	action: actions.auth.login

cli.addCommand
	command: 'logout'
	description: 'logout from resin.io'
	action: actions.auth.logout
	permission: 'user'

cli.addCommand
	command: 'signup'
	description: 'signup to resin.io'
	action: actions.auth.signup

# ---------- App Module ----------
cli.addResource
	name: 'app'
	displayName: 'application'
	actions: actions.app
	permission: 'user'

cli.addCommand
	command: 'app:restart <id>'
	description: 'restart an application'
	action: actions.app.restart
	permission: 'user'

# ---------- Device Module ----------
cli.addResource
	name: 'device'
	displayName: 'device'
	actions: actions.device
	permission: 'user'

cli.addCommand
	command: 'device:identify <uuid>'
	description: 'identify a device with a UUID'
	action: actions.device.identify
	permission: 'user'

# ---------- Preferences Module ----------
cli.addCommand
	command: 'preferences'
	description: 'open preferences form'
	action: actions.preferences.preferences
	permission: 'user'

# ---------- Keys Module ----------
cli.addResource
	name: 'key'
	displayName: 'ssh key'
	actions: actions.keys
	permission: 'user'

# ---------- Env Module ----------
cli.addResource
	name: 'env'
	displayName: 'environment variable'
	actions: actions.env
	permission: 'user'

# ---------- Logs Module ----------
cli.addCommand
	command: 'logs <uuid>'
	description: 'show device logs'
	action: actions.logs.logs
	permission: 'user'

# ---------- OS Module ----------
cli.addCommand
	command: 'os:download <id>'
	description: 'download device OS'
	action: actions.os.download
	permission: 'user'

resin.data.prefix.set resin.settings.get('dataPrefix'), (error) ->
	resin.errors.handle(error) if error?

	cli.parse(process.argv)

	quiet = cli.getArgument('quiet')
	resin.log.setQuiet(quiet)
