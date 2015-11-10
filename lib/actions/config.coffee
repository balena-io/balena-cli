Promise = require('bluebird')
umount = Promise.promisifyAll(require('umount'))
resin = require('resin-sdk')
imagefs = require('resin-image-fs')
visuals = require('resin-cli-visuals')
prettyjson = require('prettyjson')
rindle = require('rindle')

exports.read =
	signature: 'config read'
	description: 'read a device configuration'
	help: '''
		Use this command to read the config.json file from a provisioned device

		Example:

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
			resin.models.device.getManifestBySlug(options.type).then (manifest) ->
				config = manifest.configuration?.config

				if not config?
					throw new Error("Unsupported device type: #{options.type}")

				imagefs.read
					image: drive
					partition: config.partition
					path: config.path
		.then(rindle.extract)
		.then(JSON.parse)
		.then (config) ->
			console.log(prettyjson.render(config))
		.nodeify(done)
