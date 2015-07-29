_ = require('lodash')
os = require('os')

exports.handle = (error, exit = true) ->
	return if not error? or error not instanceof Error

	if process.env.DEBUG
		console.error(error.stack)
	else
		if error.code is 'EISDIR'
			console.error("File is a directory: #{error.path}")

		else if error.code is 'ENOENT'
			console.error("No such file or directory: #{error.path}")

		else if error.code is 'EACCES' or error.code is 'EPERM'
			message = 'You don\'t have enough privileges to run this operation.\n'

			if os.platform() is 'win32'
				message += 'Run a new Command Prompt as administrator and try running this command again.'
			else
				message += 'Try running this command again prefixing it with `sudo`.'

			console.error(message)

		else if error.code is 'ENOGIT'
			console.error '''
				Git is not installed on this system.
				Head over to http://git-scm.com to install it and run this command again.
			'''

		else if error.message?
			console.error(error.message)

	if _.isNumber(error.exitCode)
		errorCode = error.exitCode
	else
		errorCode = 1

	process.exit(errorCode) if exit
