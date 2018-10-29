###
Copyright 2016-2017 Balena

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
###

Raven = require('raven')
Raven.disableConsoleAlerts()
Raven.config require('./config').sentryDsn,
	captureUnhandledRejections: true,
	autoBreadcrumbs: true,
	release: require('../package.json').version
.install (logged, error) ->
	console.error(error)
	process.exit(1)
Raven.setContext
	extra:
		args: process.argv
		node_version: process.version

validNodeVersions = require('../package.json').engines.node
if not require('semver').satisfies(process.version, validNodeVersions)
	console.warn """
	Warning: this version of Node does not match the requirements of this package.
	This package expects #{validNodeVersions}, but you're using #{process.version}.
	This may cause unexpected behaviour.

	To upgrade your Node, visit https://nodejs.org/en/download/

	"""


# Doing this before requiring any other modules,
# including the 'balena-sdk', to prevent any module from reading the http proxy config
# before us
globalTunnel = require('global-tunnel-ng')
settings = require('balena-settings-client')
try
	proxy = settings.get('proxy') or null
catch
	proxy = null
# Init the tunnel even if the proxy is not configured
# because it can also get the proxy from the http(s)_proxy env var
# If that is not set as well the initialize will do nothing
globalTunnel.initialize(proxy)

# TODO: make this a feature of capitano https://github.com/balena-io/capitano/issues/48
global.PROXY_CONFIG = globalTunnel.proxyConfig

Promise = require('bluebird')
capitano = require('capitano')
capitanoExecuteAsync = Promise.promisify(capitano.execute)

# We don't yet use balena-sdk directly everywhere, but we set up shared
# options correctly so we can do safely in submodules
BalenaSdk = require('balena-sdk')
BalenaSdk.setSharedOptions(
	apiUrl: settings.get('apiUrl')
	imageMakerUrl: settings.get('imageMakerUrl')
	dataDirectory: settings.get('dataDirectory')
	retries: 2
)

balena = BalenaSdk.fromSharedOptions()

actions = require('./actions')
errors = require('./errors')
events = require('./events')
update = require('./utils/update')
{ exitWithExpectedError } = require('./utils/patterns')

# Assign bluebird as the global promise library
# stream-to-promise will produce native promises if not
# for this module, which could wreak havoc in this
# bluebird-only codebase.
require('any-promise/register/bluebird')

capitano.permission 'user', (done) ->
	balena.auth.isLoggedIn().then (isLoggedIn) ->
		if not isLoggedIn
			exitWithExpectedError('''
				You have to log in to continue

				Run the following command to go through the login wizard:

				  $ balena login
			''')
	.nodeify(done)

capitano.command
	signature: '*'
	action: ->
		capitano.execute(command: 'help')

capitano.globalOption
	signature: 'help'
	boolean: true
	alias: 'h'

# ---------- Info Module ----------
capitano.command(actions.info.version)

# ---------- Help Module ----------
capitano.command(actions.help.help)

# ---------- Wizard Module ----------
capitano.command(actions.wizard.wizard)

# ---------- Api key module ----------
capitano.command(actions.apiKey.generate)

# ---------- App Module ----------
capitano.command(actions.app.create)
capitano.command(actions.app.list)
capitano.command(actions.app.remove)
capitano.command(actions.app.restart)
capitano.command(actions.app.info)

# ---------- Auth Module ----------
capitano.command(actions.auth.login)
capitano.command(actions.auth.logout)
capitano.command(actions.auth.signup)
capitano.command(actions.auth.whoami)

# ---------- Device Module ----------
capitano.command(actions.device.list)
capitano.command(actions.device.supported)
capitano.command(actions.device.rename)
capitano.command(actions.device.init)
capitano.command(actions.device.remove)
capitano.command(actions.device.identify)
capitano.command(actions.device.reboot)
capitano.command(actions.device.shutdown)
capitano.command(actions.device.enableDeviceUrl)
capitano.command(actions.device.disableDeviceUrl)
capitano.command(actions.device.getDeviceUrl)
capitano.command(actions.device.hasDeviceUrl)
capitano.command(actions.device.register)
capitano.command(actions.device.move)
capitano.command(actions.device.info)

# ---------- Notes Module ----------
capitano.command(actions.notes.set)

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

# ---------- OS Module ----------
capitano.command(actions.os.versions)
capitano.command(actions.os.download)
capitano.command(actions.os.buildConfig)
capitano.command(actions.os.configure)
capitano.command(actions.os.initialize)

# ---------- Config Module ----------
capitano.command(actions.config.read)
capitano.command(actions.config.write)
capitano.command(actions.config.inject)
capitano.command(actions.config.reconfigure)
capitano.command(actions.config.generate)

# ---------- Settings Module ----------
capitano.command(actions.settings.list)

# ---------- Logs Module ----------
capitano.command(actions.logs)

# ---------- Sync Module ----------
capitano.command(actions.sync)

# ---------- Preload Module ----------
capitano.command(actions.preload)

# ---------- SSH Module ----------
capitano.command(actions.ssh)

# ---------- Local balenaOS Module ----------
capitano.command(actions.local.configure)
capitano.command(actions.local.flash)
capitano.command(actions.local.logs)
capitano.command(actions.local.push)
capitano.command(actions.local.ssh)
capitano.command(actions.local.scan)
capitano.command(actions.local.stop)

# ---------- Public utils ----------
capitano.command(actions.util.availableDrives)

# ---------- Internal utils ----------
capitano.command(actions.internal.osInit)
capitano.command(actions.internal.scanDevices)
capitano.command(actions.internal.sudo)

#------------ Local build and deploy -------
capitano.command(actions.build)
capitano.command(actions.deploy)

#------------ Push/remote builds -------
capitano.command(actions.push.push)

#------------ Join/Leave -------
capitano.command(actions.join.join)
capitano.command(actions.leave.leave)

update.notify()

cli = capitano.parse(process.argv)
runCommand = ->
	console.error(
		'''
		*****
		Please note: the "resin" command-line tool has been replaced with "balena".
		Only balena will be actively maintained. Get it at: https://balena.io
		*****
		''')
	if cli.global?.help
		capitanoExecuteAsync(command: "help #{cli.command ? ''}")
	else
		capitanoExecuteAsync(cli)

Promise.all([events.trackCommand(cli), runCommand()])
.catch(errors.handle)
