_ = require('lodash')

exports.handle = (error, exit = true) ->
	return if not error? or error not instanceof Error

	if process.env.DEBUG
		console.error(error.stack)
	else
		if error.code is 'EISDIR'
			console.error("File is a directory: #{error.path}")

		else if error.code is 'ENOENT'
			console.error("No such file or directory: #{error.path}")

		else if error.code is 'EACCES'
			console.error('You don\'t have enough privileges to run this operation.')

		else if error.message?
			console.error(error.message)

	if _.isNumber(error.exitCode)
		errorCode = error.exitCode
	else
		errorCode = 1

	process.exit(errorCode) if exit
