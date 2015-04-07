fs = require('fs')
progressStream = require('progress-stream')
diskio = require('diskio')

exports.name = 'Raspberry Pi'

exports.write = (options, callback) ->
	imageFileSize = fs.statSync(options.image).size

	if imageFileSize is 0
		error = new Error("Invalid OS image: #{options.image}. The image is 0 bytes.")
		return callback(error)

	progress = progressStream
		length: imageFileSize
		time: 500

	if not options.quiet
		progress.on('progress', options.progress)

	imageFileStream = fs.createReadStream(options.image).pipe(progress)
	diskio.writeStream(options.device, imageFileStream, callback)
