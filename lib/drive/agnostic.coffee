progressStream = require('progress-stream')
fs = require('fs')
_ = require('lodash-contrib')

exports.writeImage = (imagePath, devicePath, onProgress, callback) ->

	imageFileSize = fs.statSync(imagePath).size

	if imageFileSize is 0
		error = new Error("Invalid OS image: #{imagePath}. The image is 0 bytes.")
		return callback(error)

	progress = progressStream
		length: imageFileSize
		time: 500

	progress.on('progress', onProgress or _.noop)

	deviceFileStream = fs.createWriteStream devicePath,
		flags: 'rs+'

	deviceFileStream.on('error', callback)

	imageFileStream = fs.createReadStream(imagePath)
	imageFileStream
		.pipe(progress)
		.pipe(deviceFileStream)
		.on('error', _.unary(callback))
		.on('close', _.unary(callback))
