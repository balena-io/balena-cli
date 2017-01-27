###
Copyright 2016 Resin.io

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

# Loads '.resin-sync.yml' configuration from 'source' directory.
# Returns the configuration object on success
#
# TODO: Use 'config.load()' method from `resin sync` when resin sync gets
# integrated into resin CLI
loadConfig = (source) ->
	fs = require('fs')
	path = require('path')
	_ = require('lodash')
	jsYaml = require('js-yaml')

	configPath = path.join(source, '.resin-sync.yml')
	try
		config = fs.readFileSync(configPath, encoding: 'utf8')
		result = jsYaml.safeLoad(config)
	catch error
		# return empty object if '.resin-sync.yml' is missing
		if error.code is 'ENOENT'
			return {}
		throw error

	if not _.isPlainObject(result)
		throw new Error("Invalid configuration file: #{configPath}")

	return result

module.exports =
	signature: 'sync [uuid]'
	description: '(beta) sync your changes to a device'
	help: '''
		Warning: 'resin sync' requires an openssh-compatible client and 'rsync' to
		be correctly installed in your shell environment. For more information (including
		Windows support) please check the README here: https://github.com/resin-io/resin-cli

		Use this command to sync your local changes to a certain device on the fly.

		After every 'resin sync' the updated settings will be saved in
		'<source>/.resin-sync.yml' and will be used in later invocations. You can
		also change any option by editing '.resin-sync.yml' directly.

		Here is an example '.resin-sync.yml' :

			$ cat $PWD/.resin-sync.yml
			uuid: 7cf02a6
			destination: '/usr/src/app'
			before: 'echo Hello'
			after: 'echo Done'
			ignore:
				- .git
				- node_modules/

		Command line options have precedence over the ones saved in '.resin-sync.yml'.

		If '.gitignore' is found in the source directory then all explicitly listed files will be
		excluded from the syncing process. You can choose to change this default behavior with the
		'--skip-gitignore' option.

		Examples:

			$ resin sync 7cf02a6 --source . --destination /usr/src/app
			$ resin sync 7cf02a6 -s /home/user/myResinProject -d /usr/src/app --before 'echo Hello' --after 'echo Done'
			$ resin sync --ignore lib/
			$ resin sync --verbose false
			$ resin sync
	'''
	permission: 'user'
	primary: true
	options: [
			signature: 'source'
			parameter: 'path'
			description: 'local directory path to synchronize to device'
			alias: 's'
		,
			signature: 'destination'
			parameter: 'path'
			description: 'destination path on device'
			alias: 'd'
		,
			signature: 'ignore'
			parameter: 'paths'
			description: 'comma delimited paths to ignore when syncing'
			alias: 'i'
		,
			signature: 'skip-gitignore'
			boolean: true
			description: 'do not parse excluded/included files from .gitignore'
		,
			signature: 'before'
			parameter: 'command'
			description: 'execute a command before syncing'
			alias: 'b'
		,
			signature: 'after'
			parameter: 'command'
			description: 'execute a command after syncing'
			alias: 'a'
		,
			signature: 'port'
			parameter: 'port'
			description: 'ssh port'
			alias: 't'
		,
			signature: 'progress'
			boolean: true
			description: 'show progress'
			alias: 'p'
		,
			signature: 'verbose'
			boolean: true
			description: 'increase verbosity'
			alias: 'v'
		,
	]
	action: (params, options, done) ->
		fs = require('fs')
		path = require('path')
		resin = require('resin-sdk-preconfigured')
		Promise = require('bluebird')
		resinSync = require('resin-sync')
		patterns = require('../utils/patterns')

		Promise.try ->
			try
				fs.accessSync(path.join(process.cwd(), '.resin-sync.yml'))
			catch
				if not options.source?
					throw new Error('No --source option passed and no \'.resin-sync.yml\' file found in current directory.')

			options.source ?= process.cwd()

			# TODO: Add comma separated options to Capitano
			if options.ignore?
				options.ignore = options.ignore.split(',')

			Promise.resolve(params.uuid)
			.then (uuid) ->
				if not uuid?
					savedUuid = loadConfig(options.source).uuid
					return patterns.inferOrSelectDevice(savedUuid)

				resin.models.device.has(uuid)
				.then (hasDevice) ->
					if not hasDevice
						throw new Error("Device not found: #{uuid}")
					return uuid
			.then (uuid) ->
				resinSync.sync(uuid, options)
		.nodeify(done)
