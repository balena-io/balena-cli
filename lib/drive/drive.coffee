fs = require('fs')
eventStream = require('event-stream')
progressStream = require('progress-stream')

blockAligner = (blockSize) ->
	return eventStream.through (chunk) ->
		size = chunk.length % blockSize

		if size isnt 0
			newChunk = new Buffer(chunk.length + (blockSize - size))
			chunk.copy(newChunk)
			chunk = newChunk

		@emit('data', chunk)

exports.writeImage = (devicePath, imagePath, options = {}, callback = _.noop) ->

	if not fs.existsSync(imagePath)
		return callback(new Error("Invalid OS image: #{imagePath}"))

	if not fs.existsSync(devicePath)
		return callback(new Error("Invalid device: #{devicePath}"))

	imageFile = fs.createReadStream(imagePath)

	deviceFile = fs.createWriteStream devicePath,
		# Required by Windows to work correctly
		flags: 'r+'

	imageFileSize = fs.statSync(imagePath).size

	progress = progressStream
		length: imageFileSize
		time: 500

	if options.progress
		progress.on('progress', options.onProgress)

	imageFile
		.pipe(blockAligner(512))
		.pipe(progress)
		.pipe(deviceFile)

		# TODO: We should make use of nodewindows.elevate()
		# if we get an EPERM error.
		.on 'error', (error) ->
			if error.code is 'EBUSY'
				error.message = "Try umounting #{error.path} first."
			return callback(error)

		.on('close', callback)
