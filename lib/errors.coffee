chalk = require('chalk')
errors = require('resin-cli-errors')

exports.handle = (error) ->
	message = errors.interpret(error)
	return if not message?

	if process.env.DEBUG
		message = error.stack

	console.error(chalk.red(message))
	process.exit(error.exitCode or 1)
