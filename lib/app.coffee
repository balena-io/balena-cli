packageJSON = require('../package.json')
data = require('./data/data')
config = require('./config')

yargs = require('yargs')
yargs.command = require('./yargs-command/yargs-command')

# ---------- Auth Module ----------
auth = require('./actions/auth')

# TODO: Re enable optional interactivity
yargs.command('login [username:password]', auth.login)
yargs.command('logout', auth.logout)
yargs.command('signup', auth.signup)

# ---------- App Module ----------
app = require('./actions/app')
yargs.command('apps', app.list)
yargs.command('app <id>', app.info)

# ---------- Device Module ----------
device = require('./actions/device')
yargs.command('devices <id>', device.list)

# ---------- Preferences Module ----------
preferences = require('./actions/preferences')
yargs.command('preferences', preferences.preferences)

data.prefix.set config.dataPrefix, (error) ->
	throw error if error?
	yargs.command.run()
