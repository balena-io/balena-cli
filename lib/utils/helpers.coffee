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
capitano = Promise.promisifyAll(require('capitano'))
_ = require('lodash')
_.str = require('underscore.string')
president = Promise.promisifyAll(require('president'))
resin = require('resin-sdk-preconfigured')
imagefs = require('resin-image-fs')
rindle = require('rindle')
os = require('os')
chalk = require('chalk')

exports.getGroupDefaults = (group) ->
	return _.chain(group)
		.get('options')
		.map (question) ->
			return [ question.name, question.default ]
		.object()
		.value()

exports.stateToString = (state) ->
	percentage = _.str.lpad(state.percentage, 3, '0') + '%'
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

exports.sudo = (command, message) ->
	command = _.union(_.take(process.argv, 2), command)
	console.log(message)

	if os.platform() isnt 'win32'
		console.log('Type your computer password to continue')

	return president.executeAsync(command)

exports.getManifest = (image, deviceType) ->

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
