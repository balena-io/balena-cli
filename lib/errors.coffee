chalk = require('chalk')
errors = require('resin-cli-errors')
patterns = require('./utils/patterns')

exports.handle = (error) ->
	message = errors.interpret(error)
	return if not message?

	if process.env.DEBUG
		message = error.stack

	patterns.printErrorMessage(message)
	process.exit(error.exitCode or 1)
