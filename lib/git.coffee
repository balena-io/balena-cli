child_process = require('child_process')

exports.isGitDirectory = (directory, callback) ->
	exports.execute 'status', directory, (error, stdout, stderr) ->
		return callback(null, not error?)

exports.execute = (command, cwd, callback) ->
	child_process.exec("git #{command}", { cwd }, callback)
