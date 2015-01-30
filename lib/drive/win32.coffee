childProcess = require('child_process')
path = require('path')
_ = require('lodash-contrib')
async = require('async')
fs = require('fs')

scriptsPath = path.join(__dirname, 'scripts')
diskpartRescanScriptPath = path.join(scriptsPath, 'diskpart_rescan')
diskpartRescanCommand = "diskpart /s \"#{diskpartRescanScriptPath}\""

exports.rescanDrives = (callback) ->
	childProcess.exec(diskpartRescanCommand, {}, _.unary(callback))

exports.eraseMBR = (devicePath, callback) ->
	bufferSize = 512

	async.waterfall([

		(callback) ->
			fs.open(devicePath, 'rs+', null, callback)

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
