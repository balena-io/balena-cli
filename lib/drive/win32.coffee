os = require('os')
childProcess = require('child_process')
path = require('path')
_ = require('lodash-contrib')
async = require('async')
fs = require('fs')
tableParser = require('table-parser')

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

exports.list = (callback) ->
	childProcess.exec 'wmic diskdrive get DeviceID, Caption, Size', {}, (error, stdout, stderr) ->
		return callback(error) if error?

		if not _.isEmpty(stderr)
			return callback(new Error(stderr))

		result = tableParser.parse(stdout)

		result = _.map result, (row) ->
			size = _.parseInt(row.Size[0]) / 1e+9

			return {
				device: _.first(row.DeviceID)
				size: "#{Math.floor(size)} GB"
				description: row.Caption.join(' ')
			}

		return callback(null, result)
