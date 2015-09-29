fs = require('fs')
manager = require('resin-image-manager')
visuals = require('resin-cli-visuals')
helpers = require('../utils/helpers')

exports.download =
	signature: 'os download <type>'
	description: 'download an unconfigured os image'
	help: '''
		Use this command to download an unconfigured os image for a certain device type.

		Examples:

			$ resin os download parallella -o ../foo/bar/parallella.img
	'''
	permission: 'user'
	options: [
		signature: 'output'
		description: 'output path'
		parameter: 'output'
		alias: 'o'
		required: 'You have to specify an output location'
	]
	action: (params, options, done) ->
		console.info("Getting device operating system for #{params.type}")

		manager.get(params.type).then (stream) ->
			bar = new visuals.Progress('Downloading Device OS')
			spinner = new visuals.Spinner('Downloading Device OS (size unknown)')

			stream.on 'progress', (state) ->
				if state?
					bar.update(state)
				else
					spinner.start()

			stream.on 'end', ->
				spinner.stop()

			output = fs.createWriteStream(options.output)

			return helpers.waitStream(stream.pipe(output)).return(options.output)
		.tap (output) ->
			console.log("The image was downloaded to #{output}")
		.nodeify(done)
