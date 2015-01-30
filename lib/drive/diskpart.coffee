_ = require('lodash')
childProcess = require('child_process')
fs = require('fs')
path = require('path')
async = require('async')

exports.runScript = (scriptPath, callback) ->
	async.waterfall([

		(callback) ->
			fs.exists scriptPath, (exists) ->
				if not exists
					error = new Error("Diskpart script does not exist: #{scriptPath}")
				return callback()

		(callback) ->
			command = "diskpart /s \"#{scriptPath}\""
			childProcess.exec command, {}, (error, stdout, stderr) ->
				return callback(new Error(stderr)) if not _.isEmpty(stderr)
				return callback(null, stdout)

	], callback)

exports.getTempScriptPath = ->
	currentTime = new Date().getTime()
	return path.join(process.env.TEMP, "_diskpart-#{currentTime}")

exports.evaluate = (input, callback) ->

	scriptFilePath = exports.getTempScriptPath()

	async.waterfall([

		(callback) ->
			fs.writeFile(scriptFilePath, input.join('\n'), callback)

		(callback) ->
			exports.runScript(scriptFilePath, callback)

		(output, callback) ->
			fs.unlink scriptFilePath, (error) ->
				return callback(error) if error?
				return callback(null, output)

	], callback)
