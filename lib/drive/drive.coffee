fs = require('fs')
progressStream = require('progress-stream')

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
		.pipe(progress)
		.pipe(deviceFile)

		# TODO: We should make use of nodewindows.elevate()
		# if we get an EPERM error.
		.on 'error', (error) ->
			if error.code is 'EBUSY'
				error.message = "Try umounting #{error.path} first."
			return callback(error)

		.on('close', callback)
