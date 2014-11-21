data = require('./data/data')
log = require('./log/log')
config = require('./config')
packageJSON = require('../package.json')

program = require('commander')
program.version(packageJSON.version)

# ---------- Options ----------
program.option('-y, --yes', 'Confirm non interactively')
program.option('-q, --quiet', 'quiet (no output)')

# ---------- Auth Module ----------
auth = require('./actions/auth')

program
	.command('login [username:password]')
	.description('Login to resin.io')
	.action(auth.login)

program
	.command('logout')
	.description('Logout from resin.io')
	.action(auth.logout)

program
	.command('signup')
	.description('Signup to resin.io')
	.action(auth.signup)

# ---------- App Module ----------
app = require('./actions/app')

program
	.command('apps')
	.description('List your applications')
	.action(app.list)

program
	.command('app <id>')
	.description('List a single application')
	.action(app.info)

program
	.command('app:restart <id>')
	.description('Restart an application')
	.action(app.restart)

program
	.command('app:rm <id>')
	.description('Remove an application')
	.action(app.remove)

# ---------- Device Module ----------
device = require('./actions/device')

program
	.command('devices <id>')
	.description('Show devices for an application')
	.action(device.list)

program
	.command('device:rm <id>')
	.description('Remove a device')
	.action(device.remove)

program
	.command('device:identify <uuid>')
	.description('Identify a device with a UUID')
	.action(device.identify)

# ---------- Preferences Module ----------
preferences = require('./actions/preferences')

program
	.command('preferences')
	.description('Open preferences form')
	.action(preferences.preferences)

# ---------- Info Module ----------
program
	.command('version')
	.description('Show version')
	.action ->
		log.out(packageJSON.version)

# ---------- Keys Module ----------
keys = require('./actions/keys')

program
	.command('keys')
	.description('List all SSH keys')
	.action(keys.list)

program
	.command('key <id>')
	.description('List a single SSH key')
	.action(keys.info)

program
	.command('key:rm <id>')
	.description('Remove a SSH key')
	.action(keys.remove)

data.prefix.set config.dataPrefix, (error) ->
	throw error if error?
	program.parse(process.argv)
	log.setQuiet(program.quiet)
