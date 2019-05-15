###
Copyright 2017 Balena

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

BOOT_PARTITION = 1
CONNECTIONS_FOLDER = '/system-connections'

getConfigurationSchema = (connnectionFileName = 'resin-wifi') ->
	mapper: [
		{
			template:
				persistentLogging: '{{persistentLogging}}'
			domain: [
				[ 'config_json', 'persistentLogging' ]
			]
		}
		{
			template:
				hostname: '{{hostname}}'
			domain: [
				[ 'config_json', 'hostname' ]
			]
		}
		{
			template:
				wifi:
					ssid: '{{networkSsid}}'
				'wifi-security':
					psk: '{{networkKey}}'
			domain: [
				[ 'system_connections', connnectionFileName, 'wifi' ]
				[ 'system_connections', connnectionFileName, 'wifi-security' ]
			]
		}
	]
	files:
		system_connections:
			fileset: true
			type: 'ini'
			location:
				path: CONNECTIONS_FOLDER.slice(1)
				# Reconfix still uses the older resin-image-fs, so still needs an
				# object-based partition definition.
				partition: BOOT_PARTITION
		config_json:
			type: 'json'
			location:
				path: 'config.json'
				partition: BOOT_PARTITION

inquirerOptions = (data) -> [
	{
		message: 'Network SSID'
		type: 'input'
		name: 'networkSsid'
		default: data.networkSsid
	}
	{
		message: 'Network Key'
		type: 'input'
		name: 'networkKey'
		default: data.networkKey
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

getConfiguration = (data) ->
	_ = require('lodash')
	inquirer = require('inquirer')

	# `persistentLogging` can be `undefined`, so we want
	# to make sure that case defaults to `false`
	data = _.assign data,
		persistentLogging: data.persistentLogging or false

	inquirer.prompt(inquirerOptions(data))
	.then (answers) ->
		return _.merge(data, answers)

# Taken from https://goo.gl/kr1kCt
CONNECTION_FILE = '''
	[connection]
	id=resin-wifi
	type=wifi

	[wifi]
	hidden=true
	mode=infrastructure
	ssid=My_Wifi_Ssid

	[wifi-security]
	auth-alg=open
	key-mgmt=wpa-psk
	psk=super_secret_wifi_password

	[ipv4]
	method=auto

	[ipv6]
	addr-gen-mode=stable-privacy
	method=auto
'''

###
* if the `resin-wifi` file exists (previously configured image or downloaded from the UI) it's used and reconfigured
* if the `resin-sample.ignore` exists it's copied to `resin-wifi`
* if the `resin-sample` exists it's reconfigured (legacy mode, will be removed eventually)
* otherwise, the new file is created
###
prepareConnectionFile = (target) ->
	_ = require('lodash')
	imagefs = require('resin-image-fs')

	imagefs.listDirectory
		image: target
		partition: BOOT_PARTITION
		path: CONNECTIONS_FOLDER
	.then (files) ->
		# The required file already exists
		if _.includes(files, 'resin-wifi')
			return null

		# Fresh image, new mode, accoding to https://github.com/balena-os/meta-balena/pull/770/files
		if _.includes(files, 'resin-sample.ignore')
			return imagefs.copy
				image: target
				partition: BOOT_PARTITION
				path: "#{CONNECTIONS_FOLDER}/resin-sample.ignore"
			,
				image: target
				partition: BOOT_PARTITION
				path: "#{CONNECTIONS_FOLDER}/resin-wifi"
			.thenReturn(null)

		# Legacy mode, to be removed later
		# We return the file name override from this branch
		# When it is removed the following cleanup should be done:
		# * delete all the null returns from this method
		# * turn `getConfigurationSchema` back into the constant, with the connection filename always being `resin-wifi`
		# * drop the final `then` from this method
		# * adapt the code in the main listener to not receive the config from this method, and use that constant instead
		if _.includes(files, 'resin-sample')
			return 'resin-sample'

		# In case there's no file at all (shouldn't happen normally, but the file might have been removed)
		return imagefs.writeFile
			image: target
			partition: BOOT_PARTITION
			path: "#{CONNECTIONS_FOLDER}/resin-wifi"
		, CONNECTION_FILE
		.thenReturn(null)

	.then (connectionFileName) ->
		return getConfigurationSchema(connectionFileName)

removeHostname = (schema) ->
	_ = require('lodash')
	schema.mapper = _.reject schema.mapper, (mapper) ->
		_.isEqual(Object.keys(mapper.template), ['hostname'])

module.exports =
	signature: 'local configure <target>'
	description: '(Re)configure a balenaOS drive or image'
	help: '''
		Use this command to configure or reconfigure a balenaOS drive or image.

		Examples:

			$ balena local configure /dev/sdc
			$ balena local configure path/to/image.img
	'''
	root: true
	action: (params, options, done) ->
		Promise = require('bluebird')
		path = require('path')
		umount = require('umount')
		umountAsync = Promise.promisify(umount.umount)
		isMountedAsync = Promise.promisify(umount.isMounted)
		reconfix = require('reconfix')
		denymount = Promise.promisify(require('denymount'))

		prepareConnectionFile(params.target)
		.tap ->
			isMountedAsync(params.target).then (isMounted) ->
				return if not isMounted
				umountAsync(params.target)
		.then (configurationSchema) ->
			dmOpts = {}
			if process.pkg
				# when running in a standalone pkg install, the 'denymount'
				# executable is placed on the same folder as process.execPath
				dmOpts.executablePath = path.join(path.dirname(process.execPath), 'denymount')
			dmHandler = (cb) ->
				reconfix.readConfiguration(configurationSchema, params.target)
				.then(getConfiguration)
				.then (answers) ->
					if not answers.hostname
						removeHostname(configurationSchema)
					reconfix.writeConfiguration(configurationSchema, answers, params.target)
				.asCallback(cb)
			denymount params.target, dmHandler, dmOpts
		.then ->
			console.log('Done!')
		.asCallback(done)
