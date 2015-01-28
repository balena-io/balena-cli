os = require('os')
fs = require('fs')
childProcess = require('child_process')
eventStream = require('event-stream')
progressStream = require('progress-stream')

IS_WINDOWS = os.platform() is 'win32'

exports.rescanDrives = (callback) ->
	return callback() if not IS_WINDOWS
	diskpartRescanScriptPath = path.join(__dirname, 'scripts', 'diskpart_rescan')
	childProcess.exec "diskpart /s #{diskpartRescanScriptPath}", {}, (error) ->
		console.log("DISKPART RESULT: #{arguments}")
		return callback(error)

exports.writeImage = (devicePath, imagePath, options = {}, callback = _.noop) ->

	if not fs.existsSync(imagePath)
		return callback(new Error("Invalid OS image: #{imagePath}"))

	if not IS_WINDOWS and not fs.existsSync(devicePath)
		return callback(new Error("Invalid device: #{devicePath}"))

	imageFile = fs.createReadStream(imagePath)

	deviceFile = fs.createWriteStream devicePath,

		# Required by Windows to work correctly
		flags: 'rs+'

	imageFileSize = fs.statSync(imagePath).size

	progress = progressStream
		length: imageFileSize
		time: 500

	if options.progress
		progress.on('progress', options.onProgress)

	async.waterfall([

		(callback) ->
			exports.rescanDrives(callback)

		(callback) ->
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

		(callback) ->
			exports.rescanDrives(callback)

	], callback)


