_ = require('lodash')
capitano = require('capitano')
resin = require('./resin')
packageJSON = require('../package.json')
actions = require('./actions')

capitano.command
	signature: 'version'
	description: 'output the version number'
	action: ->
		resin.log.out(packageJSON.version)

capitano.command
	signature: 'help [command...]'
	description: 'show help'
	action: (params) ->
		if params.command?
			actions.help.command(params)
		else
			actions.help.general()

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

yesOption =
	signature: 'yes'
	description: 'confirm non interactively'
	boolean: true
	alias: 'y'

applicationOption =
	signature: 'application'
	parameter: 'application'
	description: 'application id'
	alias: [ 'a', 'app' ]

# ---------- Auth Module ----------
capitano.command
	signature: 'login [credentials]'
	description: 'login to resin.io'
	help: '''
		Use this command to login to your resin.io account.
		You need to login before you can use most of the commands this tool provides.

		You can pass your credentials as a colon separated string, or you can omit the
		credentials, in which case the tool will present you with an interactive login form.

		Examples:
			$ resin login username:password
			$ resin login
	'''
	action: actions.auth.login

capitano.command
	signature: 'logout'
	description: 'logout from resin.io'
	help: '''
		Use this command to logout from your resin.io account.o

		Examples:
			$ resin logout
	'''
	action: actions.auth.logout

capitano.command
	signature: 'signup'
	description: 'signup to resin.io'
	help: '''
		Use this command to signup for a resin.io account.

		In the future, this command may display a form in the terminal and handle
		the registration purely from the command line, but for reasons of simplicity,
		it opens your default web browser at the web based signup form.

		Examples:
			$ resin signup
	'''
	action: actions.auth.signup

capitano.command
	signature: 'whoami'
	description: 'get current username'
	help: '''
		Use this command to find out the current logged in username.

		Examples:
			$ resin whoami
	'''
	action: actions.auth.whoami

# ---------- App Module ----------
capitano.command
	signature: 'app create <name>'
	description: 'create an application'
	help: '''
		Use this command to create a new resin.io application.

		You can specify the application type with the `--type` option.
		Otherwise, an interactive dropdown will be shown for you to select from.

		TODO: We should support a command to list all supported device types.

		Examples:
			$ resin app create MyApp
			$ resin app create MyApp --type raspberry-pi
	'''
	action: actions.app.create
	options: [
		{
			signature: 'type'
			parameter: 'type'
			description: 'application type'
			alias: 't'
		}
	]

capitano.command
	signature: 'apps'
	description: 'list all applications'
	help: '''
		Use this command to list all your applications.

		Notice this command only shows the most important bits of information for each app.
		If you want detailed information, use resin app <id> instead.

		Examples:
			$ resin apps
	'''
	action: actions.app.list

capitano.command
	signature: 'app <id>'
	description: 'list a single application'
	help: '''
		Use this command to show detailed information for a single application.

		Examples:
			$ resin app 91
	'''
	action: actions.app.info

capitano.command
	signature: 'app rm <id>'
	description: 'remove an application'
	help: '''
		Use this command to remove a resin.io application.

		Notice this command asks for confirmation interactively.
		You can avoid this by passing the `--yes` boolean option.

		Examples:
			$ resin app rm 91
			$ resin app rm 91 --yes
	'''
	action: actions.app.remove
	options: [ yesOption ]

capitano.command
	signature: 'app restart <id>'
	description: 'restart an application'
	help: '''
		Use this command to restart all devices that belongs to a certain application.

		Examples:
			$ resin app restart 91
	'''
	action: actions.app.restart

capitano.command
	signature: 'init <id>'
	description: 'init an application'
	help: '''
		Use this command to associate a local project to an existing resin.io application.

		The application should be a git repository before issuing this command.
		Notice this command adds a `resin` git remote to your application.

		Examples:
			$ cd myApp && resin init 91
	'''
	action: actions.app.init

# ---------- Device Module ----------
capitano.command
	signature: 'devices <id>'
	description: 'list all devices'
	help: '''
		Use this command to list all devices that belong to a certain application.

		Examples:
			$ resin devices 91
	'''
	action: actions.device.list

capitano.command
	signature: 'device rename <id> [name]'
	description: 'rename a resin device'
	help: '''
		Use this command to rename a device.

		If you omit the name, you'll get asked for it interactively.

		Examples:
			$ resin device rename 317 MyPi
			$ resin device rename 317
	'''
	action: actions.device.rename

capitano.command
	signature: 'device <id>'
	description: 'list a single device'
	help: '''
		Use this command to show information about a single device.

		Examples:
			$ resin device 317
	'''
	action: actions.device.info

capitano.command
	signature: 'device rm <id>'
	description: 'remove a device'
	help: '''
		Use this command to remove a device from resin.io.

		Notice this command asks for confirmation interactively.
		You can avoid this by passing the `--yes` boolean option.

		Examples:
			$ resin device rm 317
			$ resin device rm 317 --yes
	'''
	action: actions.device.remove
	options: [ yesOption ]

capitano.command
	signature: 'device identify <uuid>'
	description: 'identify a device with a UUID'
	help: '''
		Use this command to identify a device.

		In the Raspberry Pi, the ACT led is blinked several times.

		Examples:
			$ resin device identify 23c73a12e3527df55c60b9ce647640c1b7da1b32d71e6a39849ac0f00db828
	'''
	action: actions.device.identify

# ---------- Preferences Module ----------
capitano.command
	signature: 'preferences'
	description: 'open preferences form'
	help: '''
		Use this command to open the preferences form.

		In the future, we will allow changing all preferences directly from the terminal.
		For now, we open your default web browser and point it to the web based preferences form.

		Examples:
			$ resin preferences
	'''
	action: actions.preferences.preferences

# ---------- Keys Module ----------
capitano.command
	signature: 'keys'
	description: 'list all ssh keys'
	help: '''
		Use this command to list all your SSH keys.

		Examples:
			$ resin keys
	'''
	action: actions.keys.list

capitano.command
	signature: 'key add <name> <path>'
	description: 'add a SSH key to resin.io'
	action: actions.keys.add

capitano.command
	signature: 'key <id>'
	description: 'list a single ssh key'
	help: '''
		Use this command to show information about a single SSH key.

		Examples:
			$ resin key 17
	'''
	action: actions.keys.info

capitano.command
	signature: 'key rm <id>'
	description: 'remove a ssh key'
	help: '''
		Use this command to remove a SSH key from resin.io.

		Notice this command asks for confirmation interactively.
		You can avoid this by passing the `--yes` boolean option.

		Examples:
			$ resin key rm 17
			$ resin key rm 17 --yes
	'''
	action: actions.keys.remove
	options: [ yesOption ]

# ---------- Env Module ----------
capitano.command
	signature: 'envs'
	description: 'list all environment variables'
	help: '''
		Use this command to list all environment variables for a particular application.
		Notice we will support per-device environment variables soon.

		This command lists all custom environment variables set on the devices running
		the application. If you want to see all environment variables, including private
		ones used by resin, use the verbose option.

		Example:
			$ resin envs --application 91
			$ resin envs --application 91 --verbose
	'''
	action: actions.env.list
	options: [
		applicationOption

		{
			signature: 'verbose'
			description: 'show private environment variables'
			boolean: true
			alias: 'v'
		}
	]

capitano.command
	signature: 'env add <key> [value]'
	description: 'add an environment variable'
	help: '''
		Use this command to add an enviroment variable to an application.

		You need to pass the `--application` option.

		If value is omitted, the tool will attempt to use the variable's value
		as defined in your host machine.

		If the value is grabbed from the environment, a warning message will be printed.
		Use `--quiet` to remove it.

		Examples:
			$ resin env add EDITOR vim -a 91
			$ resin env add TERM -a 91
	'''
	options: [ applicationOption ]
	action: actions.env.add

capitano.command
	signature: 'env rm <id>'
	description: 'remove an environment variable'
	help: '''
		Use this command to remove an environment variable from an application.

		Don't remove resin specific variables, as things might not work as expected.

		Notice this command asks for confirmation interactively.
		You can avoid this by passing the `--yes` boolean option.

		Examples:
			$ resin env rm 215
			$ resin env rm 215 --yes
	'''
	action: actions.env.remove
	options: [ yesOption ]

# ---------- Logs Module ----------
capitano.command
	signature: 'logs <uuid>'
	description: 'show device logs'
	help: '''
		Use this command to show logs for a specific device.

		By default, the command prints all log messages and exit.

		To limit the output to the n last lines, use the `--num` option along with a number.
		This is similar to doing `resin logs <uuid> | tail -n X`.

		To continuously stream output, and see new logs in real time, use the `--tail` option.

		Examples:
			$ resin logs 23c73a12e3527df55c60b9ce647640c1b7da1b32d71e6a39849ac0f00db828
			$ resin logs 23c73a12e3527df55c60b9ce647640c1b7da1b32d71e6a39849ac0f00db828 --num 20
			$ resin logs 23c73a12e3527df55c60b9ce647640c1b7da1b32d71e6a39849ac0f00db828 --tail
	'''
	action: actions.logs.logs
	options: [
		{
			signature: 'num'
			parameter: 'num'
			description: 'number of lines to display'
			alias: 'n'
		}
		{
			signature: 'tail'
			description: 'continuously stream output'
			boolean: true
			alias: 't'
		}
	]

# ---------- OS Module ----------
capitano.command
	signature: 'os download <id>'
	description: 'download device OS'
	help: '''
		Use this command to download the device OS configured to a specific network.

		Ethernet:
			You can setup the device OS to use ethernet by setting the `--network` option to "ethernet".

		Wifi:
			You can setup the device OS to use wifi by setting the `--network` option to "wifi".
			If you set "network" to "wifi", you will need to specify the `--ssid` and `--key` option as well.

		By default, this command saved the downloaded image into a resin specific directory.
		You can save it to a custom location by specifying the `--output` option.

		Examples:
			$ resin os download 91 --network ethernet
			$ resin os download 91 --network wifi --ssid MyNetwork --key secreykey123
			$ resin os download 91 --network ethernet --output ~/MyResinOS.zip
	'''
	action: actions.os.download
	options: [
		{
			signature: 'network'
			parameter: 'network'
			description: 'network type'
			alias: 'n'
		}
		{
			signature: 'ssid'
			parameter: 'ssid'
			description: 'wifi ssid, if network is wifi'
			alias: 's'
		}
		{
			signature: 'key'
			parameter: 'key'
			description: 'wifi key, if network is wifi'
			alias: 'k'
		}
		{
			signature: 'output'
			parameter: 'output'
			description: 'output file'
			alias: 'o'
		}
	]

cli = capitano.parse(process.argv)

resin.data.prefix.set resin.settings.get('dataPrefix'), (error) ->
	resin.errors.handle(error) if error?

	resin.log.setQuiet(cli.global.quiet)

	capitano.execute(cli)
