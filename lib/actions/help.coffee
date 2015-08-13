_ = require('lodash')
_.str = require('underscore.string')
capitano = require('capitano')
columnify = require('columnify')

parse = (object) ->
	return _.object _.map object, (item) ->

		# Hacky way to determine if an object is
		# a function or a command
		if item.alias?
			signature = item.toString()
		else
			signature = item.signature.toString()

		return [
			signature
			item.description
		]

indent = (text) ->
	text = _.map _.str.lines(text), (line) ->
		return '    ' + line
	return text.join('\n')

print = (data) ->
	console.log indent columnify data,
		showHeaders: false
		minWidth: 35

general = (params, options, done) ->
	console.log('Usage: resin [COMMAND] [OPTIONS]\n')
	console.log('Commands:\n')

	# We do not want the wildcard command
	# to be printed in the help screen.
	commands = _.reject capitano.state.commands, (command) ->
		return command.isWildcard()

	print(parse(commands))

	if not _.isEmpty(capitano.state.globalOptions)
		console.log('\nGlobal Options:\n')
		print(parse(capitano.state.globalOptions))

	return done()

command = (params, options, done) ->
	capitano.state.getMatchCommand params.command, (error, command) ->
		return done(error) if error?

		if not command? or command.isWildcard()
			return done(new Error("Command not found: #{params.command}"))

		console.log("Usage: #{command.signature}")

		if command.help?
			console.log("\n#{command.help}")
		else if command.description?
			console.log("\n#{_.str.humanize(command.description)}")

		if not _.isEmpty(command.options)
			console.log('\nOptions:\n')
			print(parse(command.options))

		return done()

exports.help =
	signature: 'help [command...]'
	description: 'show help'
	help: '''
		Get detailed help for an specific command.

		Examples:

			$ resin help apps
			$ resin help os download
	'''
	action: (params, options, done) ->
		if params.command?
			command(params, options, done)
		else
			general(params, options, done)
