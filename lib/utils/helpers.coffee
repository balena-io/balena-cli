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

Promise = require('bluebird')

exports.getGroupDefaults = (group) ->
	_ = require('lodash')

	return _.chain(group)
		.get('options')
		.map (question) ->
			return [ question.name, question.default ]
		.object()
		.value()

exports.stateToString = (state) ->
	_str = require('underscore.string')
	chalk = require('chalk')

	percentage = _str.lpad(state.percentage, 3, '0') + '%'
	result = "#{chalk.blue(percentage)} #{chalk.cyan(state.operation.command)}"

	switch state.operation.command
		when 'copy'
			return "#{result} #{state.operation.from.path} -> #{state.operation.to.path}"
		when 'replace'
			return "#{result} #{state.operation.file.path}, #{state.operation.copy} -> #{state.operation.replace}"
		when 'run-script'
			return "#{result} #{state.operation.script}"
		else
			throw new Error("Unsupported operation: #{state.operation.type}")

exports.sudo = (command) ->
	_ = require('lodash')
	os = require('os')

	if os.platform() isnt 'win32'
		console.log('If asked please type your computer password to continue')

	command = _.union(_.take(process.argv, 2), command)
	presidentExecuteAsync = Promise.promisify(require('president').execute)
	return presidentExecuteAsync(command)

exports.getManifest = (image, deviceType) ->
	rindle = require('rindle')
	imagefs = require('resin-image-fs')
	resin = require('resin-sdk-preconfigured')

	# Attempt to read manifest from the first
	# partition, but fallback to the API if
	# we encounter any errors along the way.
	imagefs.read
		image: image
		partition:
			primary: 1
		path: '/device-type.json'
	.then(rindle.extractAsync)
	.then(JSON.parse)
	.catch ->
		resin.models.device.getManifestBySlug(deviceType)

exports.osProgressHandler = (step) ->
	rindle = require('rindle')
	visuals = require('resin-cli-visuals')

	step.on('stdout', process.stdout.write.bind(process.stdout))
	step.on('stderr', process.stderr.write.bind(process.stderr))

	step.on 'state', (state) ->
		return if state.operation.command is 'burn'
		console.log(exports.stateToString(state))

	progressBars =
		write: new visuals.Progress('Writing Device OS')
		check: new visuals.Progress('Validating Device OS')

	step.on 'burn', (state) ->
		progressBars[state.type].update(state)

	return rindle.wait(step)

exports.getAppInfo = (application) ->
	resin = require('resin-sdk-preconfigured')
	_ = require('lodash')
	Promise.join(
		resin.models.application.get(application),
		resin.models.config.getDeviceTypes(),
		(app, config) ->
			config = _.find(config, 'slug': app.device_type)
			if !config?
				throw new Error('Could not read application information!')
			app.arch = config.arch
			return app
	)

# A function to reliably execute a command
# in all supported operating systems, including
# different Windows environments like `cmd.exe`
# and `Cygwin`.
exports.getSubShellCommand = (command) ->
	os = require('os')

	if os.platform() is 'win32'
		return {
			program: 'cmd.exe'
			args: [ '/s', '/c', command ]
		}
	else
		return {
			program: '/bin/sh'
			args: [ '-c', command ]
		}
