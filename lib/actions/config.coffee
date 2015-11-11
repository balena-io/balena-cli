_ = require('lodash')
Promise = require('bluebird')
umount = Promise.promisifyAll(require('umount'))
stringToStream = require('string-to-stream')
resin = require('resin-sdk')
imagefs = require('resin-image-fs')
visuals = require('resin-cli-visuals')
prettyjson = require('prettyjson')
rindle = require('rindle')

getConfigPartitionInformationByType = (type) ->
	return resin.models.device.getManifestBySlug(type).then (manifest) ->
		config = manifest.configuration?.config

		if not config?
			throw new Error("Unsupported device type: #{type}")

		return config

readConfigJSON = (drive, type) ->
	return getConfigPartitionInformationByType(type).then (configuration) ->
		return imagefs.read
			image: drive
			partition: configuration.partition
			path: configuration.path
	.then(rindle.extract)
	.then(JSON.parse)

writeConfigJSON = (drive, type, config) ->
	return getConfigPartitionInformationByType(type).then (configuration) ->
		return imagefs.write
			image: drive
			partition: configuration.partition
			path: configuration.path
		, stringToStream(config)
	.then(rindle.wait)

exports.read =
	signature: 'config read'
	description: 'read a device configuration'
	help: '''
		Use this command to read the config.json file from a provisioned device

		Examples:

			$ resin config read --type raspberry-pi
			$ resin config read --type raspberry-pi --drive /dev/disk2
	'''
	options: [
		{
			signature: 'type'
			description: 'device type'
			parameter: 'type'
			alias: 't'
			required: 'You have to specify a device type'
		}
		{
			signature: 'drive'
			description: 'drive'
			parameter: 'drive'
			alias: 'd'
		}
	]
	permission: 'user'
	root: true
	action: (params, options, done) ->
		Promise.try ->
			return options.drive or visuals.drive('Select the device drive')
		.tap(umount.umountAsync)
		.then (drive) ->
			return readConfigJSON(drive, options.type)
		.tap (config) ->
			console.info(prettyjson.render(config))
		.nodeify(done)

exports.write =
	signature: 'config write <key> <value>'
	description: 'write a device configuration'
	help: '''
		Use this command to write the config.json file of a provisioned device

		Examples:

			$ resin config write --type raspberry-pi username johndoe
			$ resin config write --type raspberry-pi --drive /dev/disk2 username johndoe
			$ resin config write --type raspberry-pi files.network/settings "..."
	'''
	options: [
		{
			signature: 'type'
			description: 'device type'
			parameter: 'type'
			alias: 't'
			required: 'You have to specify a device type'
		}
		{
			signature: 'drive'
			description: 'drive'
			parameter: 'drive'
			alias: 'd'
		}
	]
	permission: 'user'
	root: true
	action: (params, options, done) ->
		Promise.try ->
			return options.drive or visuals.drive('Select the device drive')
		.tap(umount.umountAsync)
		.then (drive) ->
			readConfigJSON(drive, options.type).then (config) ->
				console.info("Setting #{params.key} to #{params.value}")
				_.set(config, params.key, params.value)
				return JSON.stringify(config)
			.tap ->
				return umount.umountAsync(drive)
			.then (config) ->
				return writeConfigJSON(drive, options.type, config)
		.tap ->
			console.info('Done')
		.nodeify(done)
