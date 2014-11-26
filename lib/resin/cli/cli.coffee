program = require('commander')
log = require('../log/log')

exports.getArgument = (name) ->
	return program[name]

exports.setVersion = (version) ->
	program.version(version)

	# Set version command automatically
	exports.addCommand 'version', 'show version', ->
		log.out(version)

exports.addCommand = (command, description, action) ->
	program
		.command(command)
		.description(description)
		.action(action)

	return program

exports.addOption = (option, description, coerceFunction) ->
	program.option(option, description, coerceFunction)

exports.parse = (argv) ->
	program.parse(argv)
