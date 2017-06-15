exports.buffer = (stream, bufferFile) ->
	Promise = require('bluebird')
	fs = require('fs')

	fileWriteStream = fs.createWriteStream(bufferFile)

	new Promise (resolve, reject) ->
		stream
		.on('error', reject)
		.on('end', resolve)
		.pipe(fileWriteStream)
	.then ->
		new Promise (resolve, reject) ->
			fs.createReadStream(bufferFile)
			.on 'open', ->
				resolve(this)
			.on('error', reject)
