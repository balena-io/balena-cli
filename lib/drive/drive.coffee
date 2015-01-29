os = require('os')
fs = require('fs')
path = require('path')
_ = require('lodash-contrib')
async = require('async')
childProcess = require('child_process')
progressStream = require('progress-stream')

IS_WINDOWS = os.platform() is 'win32'
DISK_IO_FLAGS = 'rs+'

exports.rescanDrives = (callback) ->
	return callback() if not IS_WINDOWS
	diskpartRescanScriptPath = path.join(__dirname, 'scripts', 'diskpart_rescan')
	childProcess.exec("diskpart /s \"#{diskpartRescanScriptPath}\"", {}, _.unary(callback))

exports.eraseMBR = (devicePath, callback) ->
	return callback() if not IS_WINDOWS

	bufferSize = 512

	async.waterfall([

		(callback) ->
			fs.open(devicePath, DISK_IO_FLAGS, null, callback)

		(fd, callback) ->
			buffer = new Buffer(bufferSize)
			buffer.fill(0)
			fs.write fd, buffer, 0, bufferSize, 0, (error, bytesWritten) ->
				return callback(error) if error?
				return callback(null, bytesWritten, fd)

		(bytesWritten, fd, callback) ->
			if bytesWritten isnt bufferSize
				error = "Bytes written: #{bytesWritten}, expected #{bufferSize}"
				return callback(error)

			fs.close(fd, callback)

	], callback)

exports.writeImage = (devicePath, imagePath, options = {}, callback = _.noop) ->

	if not fs.existsSync(imagePath)
		return callback(new Error("Invalid OS image: #{imagePath}"))

	if not IS_WINDOWS and not fs.existsSync(devicePath)
		return callback(new Error("Invalid device: #{devicePath}"))

	imageFileSize = fs.statSync(imagePath).size

	if imageFileSize is 0
		return callback(new Error("Invalid OS image: #{imagePath}. The image is 0 bytes."))

	progress = progressStream
		length: imageFileSize
		time: 500

	if options.progress
		progress.on('progress', options.onProgress)

	async.waterfall [

		(callback) ->
			exports.eraseMBR(devicePath, callback)

		(callback) ->
			exports.rescanDrives(callback)

		(callback) ->
			deviceFileStream = fs.createWriteStream(devicePath, flags: DISK_IO_FLAGS)
			deviceFileStream.on('error', callback)

			imageFileStream = fs.createReadStream(imagePath)
			imageFileStream
				.pipe(progress)
				.pipe(deviceFileStream)
				.on('error', _.unary(callback))
				.on('close', _.unary(callback))

		(callback) ->
			exports.rescanDrives(callback)

	], (error) ->
		return callback() if not error?

		if error.code is 'EBUSY'
			error.message = "Try umounting #{error.path} first."

		if error.code is 'ENOENT'
			error.message = "Invalid device #{error.path}"

			# Prevents outer handler to take
			# it as an usual ENOENT error
			delete error.code

		return callback(error)
