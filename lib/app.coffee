_ = require('lodash')
resin = require('./resin')
packageJSON = require('../package.json')
actions = require('./actions')
pluginLoader = require('./plugin-loader/plugin-loader')

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

resin.cli.addOption
	option: '-n, --num <num>'
	description: 'number of lines to display'

resin.cli.addOption
	option: '--tail'
	description: 'continuously stream output'

# TODO: I have to use 'application' instead of 'app' here
# as Commander gets confused with the app command
resin.cli.addOption
	option: '-a, --application <app>'
	description: 'application id'
	coerce: _.parseInt

resin.cli.addOption
	option: '-w, --network <network>'
	description: 'network type when downloading OS'

resin.cli.addOption
	option: '-s, --wifi-ssid <wifiSsid>'
	description: 'wifi ssid, if network is wifi'

resin.cli.addOption
	option: '-k, --wifi-key <wifiKey>'
	description: 'wifi key, if network is wifi'

resin.cli.addOption
	option: '-o, --output <output>'
	description: 'output file'

# ---------- Auth Module ----------
resin.cli.addCommand
	command: 'login [username:password]'
	description: 'login to resin.io'
	action: actions.auth.login

resin.cli.addCommand
	command: 'logout'
	description: 'logout from resin.io'
	action: actions.auth.logout
	permission: 'user'

resin.cli.addCommand
	command: 'signup'
	description: 'signup to resin.io'
	action: actions.auth.signup

# ---------- App Module ----------
resin.cli.addResource
	name: 'app'
	displayName: 'application'
	actions: actions.app
	permission: 'user'

resin.cli.addCommand
	command: 'app:restart <id>'
	description: 'restart an application'
	action: actions.app.restart
	permission: 'user'

# ---------- Device Module ----------
resin.cli.addResource
	name: 'device'
	displayName: 'device'
	actions: actions.device
	permission: 'user'

resin.cli.addCommand
	command: 'device:identify <uuid>'
	description: 'identify a device with a UUID'
	action: actions.device.identify
	permission: 'user'

# ---------- Preferences Module ----------
resin.cli.addCommand
	command: 'preferences'
	description: 'open preferences form'
	action: actions.preferences.preferences
	permission: 'user'

# ---------- Keys Module ----------
resin.cli.addResource
	name: 'key'
	displayName: 'ssh key'
	actions: actions.keys
	permission: 'user'

# ---------- Env Module ----------
resin.cli.addResource
	name: 'env'
	displayName: 'environment variable'
	actions: actions.env
	permission: 'user'

# ---------- Logs Module ----------
resin.cli.addCommand
	command: 'logs <uuid>'
	description: 'show device logs'
	action: actions.logs.logs
	permission: 'user'

# ---------- OS Module ----------
resin.cli.addCommand
	command: 'os:download <id>'
	description: 'download device OS'
	action: actions.os.download
	permission: 'user'

resin.data.prefix.set resin.config.dataPrefix, (error) ->
	resin.errors.handle(error) if error?

	resin.cli.parse(process.argv)

	quiet = resin.cli.getArgument('quiet')
	resin.log.setQuiet(quiet)
