###
Copyright 2017 Resin.io

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

fs = require('fs')
path = require('path')
_ = require('lodash')
Promise = require('bluebird')

inquirerOptions = (data) -> [
	{
		message: 'Enable WiFi'
		type: 'confirm'
		name: 'wifi.enable'
		default: true,
	}
	{
		message: 'Network SSID'
		type: 'input'
		name: 'wifi.networkSsid'
		default: data.networkSsid
		when: (answers) ->
			answers.wifi.enable
	}
	{
		message: 'Network Key'
		type: 'input'
		name: 'wifi.networkKey'
		default: data.networkKey
		when: (answers) ->
			answers.wifi.enable
	}
	{
		message: 'Do you want to set advanced settings?'
		type: 'confirm'
		name: 'advancedSettings'
		default: false
	}
	{
		message: 'Device Hostname'
		type: 'input'
		name: 'hostname'
		default: data.hostname,
		when: (answers) ->
			answers.advancedSettings
	}
	{
		message: 'Do you want to enable persistent logging?'
		type: 'confirm'
		name: 'persistentLogging'
		default: data.persistentLogging
		when: (answers) ->
			answers.advancedSettings
	}
]

# Since these paths are used by `resin-image-fs`, we can safely
# assume they are always UNIX style.
joinPath = (path) -> '/' + path.join('/')

loadReconfix = (target) ->
	{ Reconfix } = require('reconfix-preview')
	imagefs = require('resin-image-fs')

	reconfix = new Reconfix({
		read: (partition, path) ->
			imagefs.readFile
				image: target
				partition: partition
				path: joinPath(path)
			.catch (err) ->
				if err.code == 'NOENT'
					return Buffer.alloc(0)
				else
					throw err
			.then (content) -> Buffer.from(content, 'utf-8')
			.catch (err) -> {}
		write: (partition, path, data) ->
			imagefs.writeFile
				image: target,
				partition: partition,
				path: joinPath(path)
			, data.toString('utf-8')
	})
	schema = require('../../../extras/schemas/resin-os.json')
	reconfix.loadSchema(schema)
	Promise.resolve(reconfix)

readConfiguration = (target) ->
	loadReconfix(target)
	.then (reconfix) -> reconfix.readValues()

writeConfiguration = (config, target) ->
	loadReconfix(target)
	.then (reconfix) -> reconfix.writeValues(config)


getConfiguration = (data) ->
	inquirer = require('inquirer')

	# `persistentLogging` can be `undefined`, so we want
	# to make sure that case defaults to `false`
	data = _.assign data,
		persistentLogging: data.persistentLogging or false

	inquirer.prompt(inquirerOptions(data))
	.then (answers) -> _.omit(answers, ['advancedSettings'])
	.then (answers) -> _.merge(data, answers)

module.exports =
	signature: 'local configure <target>'
	description: '(Re)configure a resinOS drive or image'
	help: '''
		Use this command to configure or reconfigure a resinOS drive or image.

		Examples:

			$ resin local configure /dev/sdc
			$ resin local configure path/to/image.img
	'''
	root: true
	action: (params, options, done) ->
		Promise = require('bluebird')
		umount = require('umount')
		umountAsync = Promise.promisify(umount.umount)
		isMountedAsync = Promise.promisify(umount.isMounted)
		denymount = Promise.promisify(require('denymount'))

		isMountedAsync(params.target).then (isMounted) ->
			return if not isMounted
			umountAsync(params.target)
		.then ->
			denymount params.target, (cb) ->
				readConfiguration(params.target)
				.then(getConfiguration)
				.then (answers) ->
					writeConfiguration(answers, params.target)
				.asCallback(cb)
		.then ->
			console.log('Done!')
		.asCallback(done)
